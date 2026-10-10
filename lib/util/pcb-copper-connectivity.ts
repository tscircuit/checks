import type { Polygon } from "@flatten-js/core"
import {
  circlePolygon,
  getPlatedHolePolygon,
  getPourPolygon,
  getSmtPadPolygon,
  getTraceSegmentPolygon,
  getViaPolygon,
} from "@tscircuit/circuit-json-util"
import type {
  LayerRef,
  PcbCopperPour,
  PcbPlatedHole,
  PcbSmtPad,
  PcbTrace,
  PcbVia,
} from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import Flatbush from "flatbush"
import { createCopperPolygonContactTester } from "../copper-pour-connectivity/create-copper-polygon-contact-tester"
import type {
  ConnectivityNetId,
  PcbConnectivityContext,
  PcbPortId,
  PcbTraceId,
} from "./pcb-connectivity-context"

// Coordinates originate in board-world mm; scaling conditions polygon operations.
const boardMmToGeometryScale = 1e6
const copperContactToleranceMm = 1e-7
const geometryContactTolerance =
  copperContactToleranceMm * boardMmToGeometryScale
const samePositionToleranceMm = 1e-9

type CopperIslandId = number
interface CopperConductor {
  polygon: Polygon
  layers: LayerRef[]
  netId?: ConnectivityNetId
  portIds?: PcbPortId[]
  isPour?: boolean
}
interface UnsupportedCopperBounds {
  xmin: number
  ymin: number
  xmax: number
  ymax: number
  layers: LayerRef[]
}
export interface PcbCopperConnectivityOptions {
  connectivity: ConnectivityMap
  netIds?: Set<ConnectivityNetId>
  ignoreInlineVias?: boolean
  restrictToSameNet?: boolean
}
type WireRoutePoint = Extract<PcbTrace["route"][number], { route_type: "wire" }>
type ViaRoutePoint = Extract<PcbTrace["route"][number], { route_type: "via" }>

function createWireCopperPolygon({
  start,
  end,
  widthMm,
}: {
  start: { x: number; y: number }
  end: { x: number; y: number }
  widthMm: number
}) {
  return Math.hypot(start.x - end.x, start.y - end.y) <= samePositionToleranceMm
    ? circlePolygon(start, widthMm / 2)
    : getTraceSegmentPolygon(start, end, widthMm)
}

/** Source identities select legacy pour copper and attribute unsupported routes.
 * Physical edges require touching copper on a common emitted layer. */
export class PcbCopperConnectivity {
  private readonly conductors: CopperConductor[] = []
  private readonly unsupportedNetIds = new Set<ConnectivityNetId>()
  private readonly unsupportedCopperBounds: UnsupportedCopperBounds[] = []
  private readonly parentIslandIds: CopperIslandId[] = []
  private readonly islandsByPortId = new Map<PcbPortId, Set<CopperIslandId>>()
  private readonly pourIslandIds = new Set<CopperIslandId>()
  private readonly netIdsByIslandId = new Map<
    CopperIslandId,
    Set<ConnectivityNetId>
  >()
  private readonly copperPolygonsTouch = createCopperPolygonContactTester(
    geometryContactTolerance,
  )
  private readonly conductorIndex?: Flatbush

  constructor(
    private readonly options: PcbCopperConnectivityOptions,
    private readonly context: PcbConnectivityContext,
  ) {
    this.collectCopper()
    if (this.conductors.length === 0) return
    this.conductorIndex = this.createConductorIndex()
    this.connectCopperIslands()
    this.indexCopperIslands()
    this.deferNearbyUnsupportedCopper()
  }

  canVerifyNet({
    netId,
    pcbPortIds,
  }: { netId: ConnectivityNetId; pcbPortIds: PcbPortId[] }) {
    return (
      !this.unsupportedNetIds.has(netId) &&
      pcbPortIds.every((pcbPortId) =>
        this.context.modeledPortIds.has(pcbPortId),
      )
    )
  }

  arePortsConnected(pcbPortIds: PcbPortId[]) {
    return this.hasSharedCopperIsland({ pcbPortIds })
  }

  arePortsConnectedThroughPour(pcbPortIds: PcbPortId[]) {
    return (
      pcbPortIds.length >= 2 &&
      this.hasSharedCopperIsland({ pcbPortIds, requireCopperPour: true })
    )
  }

  getPortGroups(pcbPortIds: PcbPortId[]): PcbPortId[][] {
    const portGroups = new Map<CopperIslandId | PcbPortId, PcbPortId[]>()
    for (const pcbPortId of pcbPortIds) {
      const islandId =
        this.islandsByPortId.get(pcbPortId)?.values().next().value ?? pcbPortId
      const group = portGroups.get(islandId) ?? []
      group.push(pcbPortId)
      portGroups.set(islandId, group)
    }
    return [...portGroups.values()]
  }

  isPortConnectedThroughPour({
    pcbPortId,
    netId,
    requiredPcbPortIds,
  }: {
    pcbPortId: PcbPortId
    netId: ConnectivityNetId
    requiredPcbPortIds: PcbPortId[]
  }) {
    for (const islandId of this.islandsByPortId.get(pcbPortId) ?? []) {
      if (
        this.pourIslandIds.has(islandId) &&
        this.netIdsByIslandId.get(islandId)?.has(netId) &&
        requiredPcbPortIds.every((peerPcbPortId) =>
          this.islandsByPortId.get(peerPcbPortId)?.has(islandId),
        )
      )
        return true
    }
    return false
  }

  private hasSharedCopperIsland({
    pcbPortIds,
    requireCopperPour,
  }: { pcbPortIds: PcbPortId[]; requireCopperPour?: boolean }) {
    for (const islandId of this.islandsByPortId.get(pcbPortIds[0]) ?? []) {
      if (requireCopperPour && !this.pourIslandIds.has(islandId)) continue
      if (
        pcbPortIds.every((pcbPortId) =>
          this.islandsByPortId.get(pcbPortId)?.has(islandId),
        )
      )
        return true
    }
    return false
  }

  private getNetForId(circuitElementId: string | undefined) {
    return circuitElementId
      ? this.options.connectivity.getNetConnectedToId(circuitElementId)
      : undefined
  }

  private getNetForPort(pcbPortId: PcbPortId | undefined) {
    const pcbPort = pcbPortId
      ? this.context.pcbPortsById.get(pcbPortId)
      : undefined
    return (
      this.getNetForId(pcbPort?.source_port_id) ?? this.getNetForId(pcbPortId)
    )
  }

  private getNetForTrace(pcbTraceId: PcbTraceId | undefined) {
    const pcbTrace = pcbTraceId
      ? this.context.pcbTracesById.get(pcbTraceId)
      : undefined
    return (
      this.getNetForId(pcbTrace?.source_trace_id) ??
      this.getNetForId(pcbTraceId)
    )
  }

  private getNetForVia(pcbVia: PcbVia) {
    const netId =
      this.getNetForId(pcbVia.source_net_id) ??
      this.getNetForId(pcbVia.source_trace_id) ??
      this.getNetForTrace(pcbVia.pcb_trace_id)
    if (netId) return netId
    for (const pcbPortId of pcbVia.pcb_port_ids ?? []) {
      const portNetId = this.getNetForPort(pcbPortId)
      if (portNetId) return portNetId
    }
    return this.getNetForId(pcbVia.pcb_via_id)
  }

  private collectCopper() {
    for (const copper of this.context.copperElements) {
      switch (copper.type) {
        case "pcb_copper_pour":
          this.addPour(copper)
          break
        case "pcb_smtpad":
          this.addSmtPad(copper)
          break
        case "pcb_plated_hole":
          this.addPlatedHole(copper)
          break
        case "pcb_via":
          this.addVia(copper)
          break
        case "pcb_trace":
          this.addTrace(copper)
          break
      }
    }
  }

  private addConductor(conductor: CopperConductor) {
    if (
      this.options.netIds &&
      (!conductor.netId || !this.options.netIds.has(conductor.netId))
    )
      return
    if (conductor.polygon.isEmpty()) return
    this.parentIslandIds.push(this.conductors.length)
    this.conductors.push({
      ...conductor,
      polygon: conductor.polygon.scale(
        boardMmToGeometryScale,
        boardMmToGeometryScale,
      ),
    })
  }

  private addPour(pcbCopperPour: PcbCopperPour) {
    this.addConductor({
      polygon: getPourPolygon(pcbCopperPour),
      layers: [pcbCopperPour.layer],
      netId: this.getNetForId(pcbCopperPour.source_net_id),
      isPour: true,
    })
  }

  private addSmtPad(pcbSmtPad: PcbSmtPad) {
    this.addConductor({
      polygon: getSmtPadPolygon(pcbSmtPad),
      layers: [pcbSmtPad.layer],
      netId:
        this.getNetForPort(pcbSmtPad.pcb_port_id) ??
        this.getNetForId(pcbSmtPad.pcb_smtpad_id),
      portIds: pcbSmtPad.pcb_port_id ? [pcbSmtPad.pcb_port_id] : [],
    })
  }

  private addPlatedHole(pcbPlatedHole: PcbPlatedHole) {
    const pad = { hole_offset_x: 0, hole_offset_y: 0, ...pcbPlatedHole }
    const pcbComponent = pcbPlatedHole.pcb_component_id
      ? this.context.pcbComponentsById.get(pcbPlatedHole.pcb_component_id)
      : undefined
    this.addConductor({
      polygon: getPlatedHolePolygon(pad, pcbComponent?.rotation ?? 0),
      layers: pcbPlatedHole.layers,
      netId:
        this.getNetForPort(pcbPlatedHole.pcb_port_id) ??
        this.getNetForId(pcbPlatedHole.pcb_plated_hole_id),
      portIds: pcbPlatedHole.pcb_port_id ? [pcbPlatedHole.pcb_port_id] : [],
    })
  }

  private addVia(pcbVia: PcbVia) {
    this.addConductor({
      polygon: getViaPolygon(
        pcbVia,
        pcbVia.outer_diameter,
        pcbVia.hole_diameter,
      ),
      layers: pcbVia.layers,
      netId: this.getNetForVia(pcbVia),
      portIds: this.getAttachedViaPortIds(pcbVia),
    })
  }

  private getAttachedViaPortIds(pcbVia: PcbVia) {
    if (this.options.restrictToSameNet) return pcbVia.pcb_port_ids
    const attachedPortIds: PcbPortId[] = []
    for (const pcbPortId of pcbVia.pcb_port_ids ?? []) {
      const pcbPort = this.context.pcbPortsById.get(pcbPortId)
      // Pad-backed ports attach through pad copper; aliases describe local manual via ports.
      if (!pcbPort || this.context.padPortIds.has(pcbPortId)) continue
      if (!pcbPort.layers.some((layer) => pcbVia.layers.includes(layer)))
        continue
      if (
        Math.hypot(pcbPort.x - pcbVia.x, pcbPort.y - pcbVia.y) <=
        pcbVia.outer_diameter / 2 + samePositionToleranceMm
      )
        attachedPortIds.push(pcbPortId)
    }
    return attachedPortIds
  }

  private addTrace(pcbTrace: PcbTrace) {
    const netId =
      this.getNetForId(pcbTrace.source_trace_id) ??
      this.getNetForId(pcbTrace.pcb_trace_id)
    if (this.options.netIds && (!netId || !this.options.netIds.has(netId)))
      return
    if (
      pcbTrace.route_thickness_mode === "interpolated" ||
      pcbTrace.route.some(
        (point) =>
          point.route_type === "through_pad" ||
          (point.route_type === "wire" &&
            point.width_interpolation_mode !== undefined),
      )
    )
      this.recordUnsupportedTrace({ pcbTrace, netId })
    if (pcbTrace.route_thickness_mode === "interpolated") return
    for (const [routeIndex, point] of pcbTrace.route.entries()) {
      this.addTraceSegment({
        point,
        nextPoint: pcbTrace.route[routeIndex + 1],
        netId,
      })
      if (!this.options.ignoreInlineVias && point.route_type === "via")
        this.addInlineVia({ pcbTrace, point, netId })
    }
  }

  private addTraceSegment({
    point,
    nextPoint,
    netId,
  }: {
    point: PcbTrace["route"][number]
    nextPoint?: PcbTrace["route"][number]
    netId?: ConnectivityNetId
  }) {
    if (
      !nextPoint ||
      point.route_type === "through_pad" ||
      nextPoint.route_type === "through_pad"
    )
      return
    let wirePoint: WireRoutePoint
    if (
      point.route_type === "wire" &&
      nextPoint?.route_type === "wire" &&
      point.layer === nextPoint.layer
    ) {
      wirePoint = point
    } else if (
      !this.options.ignoreInlineVias &&
      point.route_type === "wire" &&
      nextPoint?.route_type === "via" &&
      point.layer === nextPoint.from_layer
    ) {
      wirePoint = point
    } else if (
      !this.options.ignoreInlineVias &&
      point.route_type === "via" &&
      nextPoint?.route_type === "wire" &&
      point.to_layer === nextPoint.layer
    ) {
      wirePoint = nextPoint
    } else return
    this.addConductor({
      polygon: createWireCopperPolygon({
        start: point,
        end: nextPoint,
        widthMm: wirePoint.width,
      }),
      layers: [wirePoint.layer],
      netId,
    })
  }

  private addInlineVia({
    pcbTrace,
    point,
    netId,
  }: { pcbTrace: PcbTrace; point: ViaRoutePoint; netId?: ConnectivityNetId }) {
    // An emitted barrel overrides the route declaration, including its layer span.
    if (
      this.context.pcbVias.some(
        (pcbVia) =>
          Math.hypot(pcbVia.x - point.x, pcbVia.y - point.y) <=
          samePositionToleranceMm,
      )
    )
      return
    if (
      !this.context.pcbLayerStack.includes(point.from_layer) ||
      !this.context.pcbLayerStack.includes(point.to_layer) ||
      !point.outer_diameter
    ) {
      this.recordUnsupportedTrace({ pcbTrace, netId })
      return
    }
    this.addConductor({
      polygon: getViaPolygon(
        point,
        point.outer_diameter,
        point.hole_diameter ?? 0,
      ),
      layers: this.getInlineViaLayers(point),
      netId,
    })
  }

  private getInlineViaLayers(point: ViaRoutePoint) {
    const fromLayerIndex = this.context.pcbLayerStack.indexOf(point.from_layer)
    const toLayerIndex = this.context.pcbLayerStack.indexOf(point.to_layer)
    return this.context.pcbLayerStack.slice(
      Math.min(fromLayerIndex, toLayerIndex),
      Math.max(fromLayerIndex, toLayerIndex) + 1,
    )
  }

  private getRoutePointLayers(point: PcbTrace["route"][number]): LayerRef[] {
    switch (point.route_type) {
      case "wire":
        return [point.layer]
      case "through_pad":
        return [point.start_layer, point.end_layer]
      case "via":
        return this.getInlineViaLayers(point)
    }
  }

  private recordUnsupportedTrace({
    pcbTrace,
    netId,
  }: { pcbTrace: PcbTrace; netId?: ConnectivityNetId }) {
    if (netId) {
      this.unsupportedNetIds.add(netId)
      return
    }
    const bounds = this.getUnsupportedTraceBounds(pcbTrace)
    if (bounds) this.unsupportedCopperBounds.push(bounds)
  }

  private getUnsupportedTraceBounds(
    pcbTrace: PcbTrace,
  ): UnsupportedCopperBounds | undefined {
    if (pcbTrace.route.length === 0) return
    let minXMm = Number.POSITIVE_INFINITY
    let minYMm = Number.POSITIVE_INFINITY
    let maxXMm = Number.NEGATIVE_INFINITY
    let maxYMm = Number.NEGATIVE_INFINITY
    let maximumCopperWidthMm = 0
    const layers = new Set<LayerRef>()
    for (const point of pcbTrace.route) {
      const routePoints =
        point.route_type === "through_pad" ? [point.start, point.end] : [point]
      for (const routePoint of routePoints) {
        minXMm = Math.min(minXMm, routePoint.x)
        minYMm = Math.min(minYMm, routePoint.y)
        maxXMm = Math.max(maxXMm, routePoint.x)
        maxYMm = Math.max(maxYMm, routePoint.y)
      }
      maximumCopperWidthMm = Math.max(
        maximumCopperWidthMm,
        point.route_type === "via" ? (point.outer_diameter ?? 0) : point.width,
      )
      for (const layer of this.getRoutePointLayers(point)) layers.add(layer)
    }
    const copperRadiusMm = maximumCopperWidthMm / 2
    return {
      xmin: (minXMm - copperRadiusMm) * boardMmToGeometryScale,
      ymin: (minYMm - copperRadiusMm) * boardMmToGeometryScale,
      xmax: (maxXMm + copperRadiusMm) * boardMmToGeometryScale,
      ymax: (maxYMm + copperRadiusMm) * boardMmToGeometryScale,
      layers: [...layers],
    }
  }

  private createConductorIndex() {
    const conductorIndex = new Flatbush(this.conductors.length)
    for (const conductor of this.conductors) {
      const bounds = conductor.polygon.box
      conductorIndex.add(bounds.xmin, bounds.ymin, bounds.xmax, bounds.ymax)
    }
    conductorIndex.finish()
    return conductorIndex
  }

  private getCandidateConductorIds(
    bounds: Pick<Polygon["box"], "xmin" | "ymin" | "xmax" | "ymax">,
  ) {
    return (
      this.conductorIndex?.search(
        bounds.xmin - geometryContactTolerance,
        bounds.ymin - geometryContactTolerance,
        bounds.xmax + geometryContactTolerance,
        bounds.ymax + geometryContactTolerance,
      ) ?? []
    )
  }

  private findCopperIsland(conductorId: CopperIslandId): CopperIslandId {
    let islandId = conductorId
    while (this.parentIslandIds[islandId] !== islandId) {
      this.parentIslandIds[islandId] =
        this.parentIslandIds[this.parentIslandIds[islandId]]
      islandId = this.parentIslandIds[islandId]
    }
    return islandId
  }

  private connectCopperIslands() {
    for (const [conductorId, conductor] of this.conductors.entries()) {
      for (const candidateId of this.getCandidateConductorIds(
        conductor.polygon.box,
      )) {
        const candidate = this.conductors[candidateId]
        if (
          candidateId <= conductorId ||
          this.findCopperIsland(conductorId) ===
            this.findCopperIsland(candidateId)
        )
          continue
        if (
          this.options.restrictToSameNet &&
          conductor.netId !== candidate.netId
        )
          continue
        if (!conductor.layers.some((layer) => candidate.layers.includes(layer)))
          continue
        if (this.copperPolygonsTouch(conductor.polygon, candidate.polygon))
          this.parentIslandIds[this.findCopperIsland(candidateId)] =
            this.findCopperIsland(conductorId)
      }
    }
  }

  private indexCopperIslands() {
    for (const [conductorId, conductor] of this.conductors.entries()) {
      const islandId = this.findCopperIsland(conductorId)
      if (conductor.netId) {
        const netIds =
          this.netIdsByIslandId.get(islandId) ?? new Set<ConnectivityNetId>()
        netIds.add(conductor.netId)
        this.netIdsByIslandId.set(islandId, netIds)
      }
      if (conductor.isPour) this.pourIslandIds.add(islandId)
      for (const pcbPortId of conductor.portIds ?? []) {
        const islands =
          this.islandsByPortId.get(pcbPortId) ?? new Set<CopperIslandId>()
        islands.add(islandId)
        this.islandsByPortId.set(pcbPortId, islands)
      }
    }
  }

  private deferNearbyUnsupportedCopper() {
    for (const bounds of this.unsupportedCopperBounds) {
      for (const conductorId of this.getCandidateConductorIds(bounds)) {
        if (
          !bounds.layers.some((layer) =>
            this.conductors[conductorId].layers.includes(layer),
          )
        )
          continue
        for (const netId of this.netIdsByIslandId.get(
          this.findCopperIsland(conductorId),
        ) ?? [])
          this.unsupportedNetIds.add(netId)
      }
    }
  }
}
