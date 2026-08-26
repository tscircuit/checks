import { distanceBetweenShapes } from "@tscircuit/circuit-json-util"
import { isPointInsidePolygon } from "@tscircuit/math-utils"
import type {
  AnyCircuitElement,
  PcbBreakoutPoint,
  PcbCopperPour,
  PcbGroundPlaneRegion,
  PcbPlatedHole,
  PcbPort,
  PcbSmtPad,
  PcbThermalSpoke,
  PcbTrace,
  PcbVia,
} from "circuit-json"
import type { PcbTraceSegment } from "lib/check-each-pcb-trace-non-overlapping/getCollidableBounds"
import {
  getCopperShapeForObstacle,
  getTraceSegments,
  type PadElement,
  type CopperShapeForObstacle,
} from "lib/check-pad-clearance/common"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"
import {
  doesTraceTouchObstacle,
  doesTraceTouchRegion,
  doLayersOverlap,
  doTraceSegmentsTouch,
  getCopperRegionPoints,
  getCopperRegionShape,
  getSegmentsByTraceId,
  getTraceLayersTouchingPoint,
} from "./geometry"
import {
  getBreakoutNodeId,
  getCopperRegionNodeId,
  getPadNodeId,
  getPortNodeId,
  getTraceNodeId,
  getViaNodeId,
  physicalContactToleranceMm,
  type CopperRegionGeometry,
  type PcbPortId,
  type PcbTraceId,
  type PhysicalCopperGroupId,
  type PhysicalCopperNodeId,
} from "./types"

export type {
  PcbPortId,
  PcbTraceId,
  PhysicalCopperGroupId,
} from "./types"

export class PhysicalPcbConnectivityMap {
  private readonly traces: PcbTrace[]
  private readonly ports: PcbPort[]
  private readonly pads: PadElement[]
  private readonly vias: PcbVia[]
  private readonly breakoutPoints: PcbBreakoutPoint[]
  private readonly copperRegions: CopperRegionGeometry[]
  private readonly thermalSpokes: PcbThermalSpoke[]
  private readonly segmentsByTraceId: Map<PcbTraceId, PcbTraceSegment[]>
  private readonly padsByPortId = new Map<PcbPortId, PadElement[]>()
  private readonly parentByNodeId = new Map<
    PhysicalCopperNodeId,
    PhysicalCopperNodeId
  >()

  constructor(circuitJson: AnyCircuitElement[]) {
    this.traces = circuitJson.filter(
      (element) => element.type === "pcb_trace",
    ) as PcbTrace[]
    this.ports = circuitJson.filter(
      (element) => element.type === "pcb_port",
    ) as PcbPort[]
    this.pads = circuitJson.filter(
      (element) =>
        element.type === "pcb_smtpad" || element.type === "pcb_plated_hole",
    ) as PadElement[]
    this.vias = circuitJson.filter(
      (element) => element.type === "pcb_via",
    ) as PcbVia[]
    this.breakoutPoints = circuitJson.filter(
      (element) => element.type === "pcb_breakout_point",
    ) as PcbBreakoutPoint[]
    this.thermalSpokes = circuitJson.filter(
      (element) => element.type === "pcb_thermal_spoke",
    ) as PcbThermalSpoke[]
    this.copperRegions = (
      circuitJson.filter(
        (element) =>
          element.type === "pcb_copper_pour" ||
          element.type === "pcb_ground_plane_region",
      ) as Array<PcbCopperPour | PcbGroundPlaneRegion>
    ).map((region) => ({
      nodeId: getCopperRegionNodeId(region),
      layer: region.layer,
      points: getCopperRegionPoints(region),
      pcbGroundPlaneId:
        region.type === "pcb_ground_plane_region"
          ? region.pcb_ground_plane_id
          : undefined,
    }))
    this.segmentsByTraceId = getSegmentsByTraceId(getTraceSegments(circuitJson))

    this.addNodes()
    this.connectPadsToPorts()
    this.connectTracesToTraces()
    this.connectTracesToObstacles()
    this.connectPadlessPortsToCopper()
    this.connectTracesThroughBreakoutPoints()
    this.connectCopperRegions()
    this.connectThermalSpokes()
  }

  private addNode(nodeId: PhysicalCopperNodeId) {
    if (!this.parentByNodeId.has(nodeId)) {
      this.parentByNodeId.set(nodeId, nodeId)
    }
  }

  private addNodes() {
    for (const trace of this.traces) {
      this.addNode(getTraceNodeId(trace.pcb_trace_id))
    }
    for (const port of this.ports) {
      this.addNode(getPortNodeId(port.pcb_port_id))
    }
    for (const pad of this.pads) this.addNode(getPadNodeId(pad))
    for (const via of this.vias) this.addNode(getViaNodeId(via.pcb_via_id))
    for (const region of this.copperRegions) this.addNode(region.nodeId)
  }

  private findRootNodeId(nodeId: PhysicalCopperNodeId): PhysicalCopperNodeId {
    const parentNodeId = this.parentByNodeId.get(nodeId)
    if (!parentNodeId) throw new Error(`Unknown physical copper node ${nodeId}`)
    if (parentNodeId === nodeId) return nodeId
    const rootNodeId = this.findRootNodeId(parentNodeId)
    this.parentByNodeId.set(nodeId, rootNodeId)
    return rootNodeId
  }

  private connectNodes(
    firstNodeId: PhysicalCopperNodeId,
    secondNodeId: PhysicalCopperNodeId,
  ) {
    this.addNode(firstNodeId)
    this.addNode(secondNodeId)
    const firstRootNodeId = this.findRootNodeId(firstNodeId)
    const secondRootNodeId = this.findRootNodeId(secondNodeId)
    if (firstRootNodeId !== secondRootNodeId) {
      this.parentByNodeId.set(secondRootNodeId, firstRootNodeId)
    }
  }

  private connectPadsToPorts() {
    for (const pad of this.pads) {
      if (!pad.pcb_port_id) continue
      this.padsByPortId.set(pad.pcb_port_id, [
        ...(this.padsByPortId.get(pad.pcb_port_id) ?? []),
        pad,
      ])
      this.connectNodes(getPadNodeId(pad), getPortNodeId(pad.pcb_port_id))
    }
  }

  private connectTracesToTraces() {
    for (let firstIndex = 0; firstIndex < this.traces.length; firstIndex++) {
      const firstTrace = this.traces[firstIndex]!
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < this.traces.length;
        secondIndex++
      ) {
        const secondTrace = this.traces[secondIndex]!
        if (
          doTraceSegmentsTouch({
            firstSegments:
              this.segmentsByTraceId.get(firstTrace.pcb_trace_id) ?? [],
            secondSegments:
              this.segmentsByTraceId.get(secondTrace.pcb_trace_id) ?? [],
          })
        ) {
          this.connectNodes(
            getTraceNodeId(firstTrace.pcb_trace_id),
            getTraceNodeId(secondTrace.pcb_trace_id),
          )
        }
      }
    }
  }

  private connectTracesToObstacles() {
    for (const trace of this.traces) {
      const traceNodeId = getTraceNodeId(trace.pcb_trace_id)
      const segments = this.segmentsByTraceId.get(trace.pcb_trace_id) ?? []
      for (const pad of this.pads) {
        if (doesTraceTouchObstacle({ trace, segments, obstacle: pad })) {
          this.connectNodes(traceNodeId, getPadNodeId(pad))
        }
      }
      for (const via of this.vias) {
        if (doesTraceTouchObstacle({ trace, segments, obstacle: via })) {
          this.connectNodes(traceNodeId, getViaNodeId(via.pcb_via_id))
        }
      }
    }
  }

  private connectPadlessPortsToCopper() {
    for (const port of this.ports) {
      if ((this.padsByPortId.get(port.pcb_port_id)?.length ?? 0) > 0) continue
      const portNodeId = getPortNodeId(port.pcb_port_id)
      for (const trace of this.traces) {
        const touchingLayers = getTraceLayersTouchingPoint({
          trace,
          segments: this.segmentsByTraceId.get(trace.pcb_trace_id) ?? [],
          point: port,
        })
        if (doLayersOverlap(port.layers, Array.from(touchingLayers))) {
          this.connectNodes(portNodeId, getTraceNodeId(trace.pcb_trace_id))
        }
      }
      for (const via of this.vias) {
        if (
          doLayersOverlap(port.layers, getLayersOfPcbElement(via)) &&
          Math.hypot(port.x - via.x, port.y - via.y) <=
            via.outer_diameter / 2 + physicalContactToleranceMm
        ) {
          this.connectNodes(portNodeId, getViaNodeId(via.pcb_via_id))
        }
      }
    }
  }

  private connectTracesThroughBreakoutPoints() {
    for (const breakoutPoint of this.breakoutPoints) {
      for (const trace of this.traces) {
        const touchingLayers = getTraceLayersTouchingPoint({
          trace,
          segments: this.segmentsByTraceId.get(trace.pcb_trace_id) ?? [],
          point: breakoutPoint,
        })
        for (const layer of touchingLayers) {
          const breakoutNodeId = getBreakoutNodeId({
            pcbBreakoutPointId: breakoutPoint.pcb_breakout_point_id,
            layer,
          })
          this.connectNodes(getTraceNodeId(trace.pcb_trace_id), breakoutNodeId)
        }
      }
    }
  }

  private connectCopperRegions() {
    for (const region of this.copperRegions) {
      const regionShape = getCopperRegionShape(region)
      for (const trace of this.traces) {
        if (
          doesTraceTouchRegion({
            trace,
            segments: this.segmentsByTraceId.get(trace.pcb_trace_id) ?? [],
            region,
          })
        ) {
          this.connectNodes(region.nodeId, getTraceNodeId(trace.pcb_trace_id))
        }
      }
      for (const pad of this.pads) {
        if (!getLayersOfPcbElement(pad).includes(region.layer)) continue
        if (
          distanceBetweenShapes(getCopperShapeForObstacle(pad), regionShape) <=
          physicalContactToleranceMm
        ) {
          this.connectNodes(region.nodeId, getPadNodeId(pad))
        }
      }
      for (const via of this.vias) {
        if (!getLayersOfPcbElement(via).includes(region.layer)) continue
        if (
          distanceBetweenShapes(getCopperShapeForObstacle(via), regionShape) <=
          physicalContactToleranceMm
        ) {
          this.connectNodes(region.nodeId, getViaNodeId(via.pcb_via_id))
        }
      }
      for (const port of this.ports) {
        if ((this.padsByPortId.get(port.pcb_port_id)?.length ?? 0) > 0) continue
        if (
          port.layers.includes(region.layer) &&
          isPointInsidePolygon(port, region.points)
        ) {
          this.connectNodes(region.nodeId, getPortNodeId(port.pcb_port_id))
        }
      }
    }

    for (
      let firstIndex = 0;
      firstIndex < this.copperRegions.length;
      firstIndex++
    ) {
      const firstRegion = this.copperRegions[firstIndex]!
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < this.copperRegions.length;
        secondIndex++
      ) {
        const secondRegion = this.copperRegions[secondIndex]!
        if (firstRegion.layer !== secondRegion.layer) continue
        if (
          distanceBetweenShapes(
            getCopperRegionShape(firstRegion),
            getCopperRegionShape(secondRegion),
          ) <= physicalContactToleranceMm
        ) {
          this.connectNodes(firstRegion.nodeId, secondRegion.nodeId)
        }
      }
    }
  }

  private connectThermalSpokes() {
    for (const thermalSpoke of this.thermalSpokes) {
      if (!thermalSpoke.pcb_plated_hole_id) continue
      const platedHole = this.pads.find(
        (pad): pad is PcbPlatedHole =>
          pad.type === "pcb_plated_hole" &&
          pad.pcb_plated_hole_id === thermalSpoke.pcb_plated_hole_id,
      )
      if (!platedHole) continue
      const spokeShape: CopperShapeForObstacle = {
        kind: "circle",
        x: platedHole.x,
        y: platedHole.y,
        radius: thermalSpoke.spoke_outer_diameter / 2,
      }
      for (const region of this.copperRegions) {
        if (region.pcbGroundPlaneId !== thermalSpoke.pcb_ground_plane_id) {
          continue
        }
        if (
          distanceBetweenShapes(spokeShape, getCopperRegionShape(region)) <=
          physicalContactToleranceMm
        ) {
          this.connectNodes(getPadNodeId(platedHole), region.nodeId)
        }
      }
    }
  }

  getPhysicalGroupIdForPort(
    pcbPortId: PcbPortId,
  ): PhysicalCopperGroupId | undefined {
    const portNodeId = getPortNodeId(pcbPortId)
    if (!this.parentByNodeId.has(portNodeId)) return undefined
    return this.findRootNodeId(portNodeId)
  }

  areTraceAndPortConnected(
    pcbTraceId: PcbTraceId,
    pcbPortId: PcbPortId,
  ): boolean {
    const traceNodeId = getTraceNodeId(pcbTraceId)
    const portNodeId = getPortNodeId(pcbPortId)
    if (
      !this.parentByNodeId.has(traceNodeId) ||
      !this.parentByNodeId.has(portNodeId)
    ) {
      return false
    }
    return this.findRootNodeId(traceNodeId) === this.findRootNodeId(portNodeId)
  }
}
