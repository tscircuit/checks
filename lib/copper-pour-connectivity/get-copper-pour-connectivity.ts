import { createCopperPolygonContactTester } from "./create-copper-polygon-contact-tester"
import type { Polygon } from "@flatten-js/core"
import type {
  AnyCircuitElement,
  LayerRef,
  PcbPort,
  PcbCopperPour,
  PcbTraceRoutePoint,
  SourceNet,
} from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import {
  getPrimaryId,
  getPlatedHolePolygon,
  getPourPolygon,
  getSmtPadPolygon,
  getTraceSegmentPolygon,
  getViaPolygon,
} from "@tscircuit/circuit-json-util"

type NetId = NonNullable<ReturnType<ConnectivityMap["getNetConnectedToId"]>>
type PcbPortId = PcbPort["pcb_port_id"]
interface Conductor {
  polygon: Polygon
  layers: LayerRef[]
  netId: NetId
  portIds?: PcbPortId[]
  isPour?: boolean
  pour?: PcbCopperPour
  isTerminal?: boolean
}

const getRouteEndpoint = (point: PcbTraceRoutePoint, side: "start" | "end") => {
  if (point.route_type === "wire") return { point, layer: point.layer }
  if (point.route_type === "via")
    return {
      point,
      layer: side === "start" ? point.from_layer : point.to_layer,
    }
  return {
    point: point[side],
    layer: side === "start" ? point.start_layer : point.end_layer,
  }
}

/** Physical pour connectivity in board-world mm (+X right, +Y up).
 * Only touching copper on a common layer forms an edge. Plated pads and vias
 * bridge their emitted layers; logical net membership never joins islands.
 * Trace segments, including interpolated widths, can connect pours. Only
 * emitted plated barrels bridge layers; logical route IDs never join islands.
 */
export function getCopperPourConnectivity(
  circuitJson: AnyCircuitElement[],
  connectivity: ConnectivityMap,
) {
  // Scale before geometric predicates to preserve tiny edges in solver BReps.
  const scale = 1e6
  const tolerance = 1e-7 * scale
  const copperPolygonsTouch = createCopperPolygonContactTester(tolerance)
  const conductors: Conductor[] = []
  const pouredNets = new Set<NetId>()
  const netForId = (id: string) => connectivity.getNetConnectedToId(id)
  const add = (conductor: Conductor) => {
    if (!conductor.polygon.isEmpty()) {
      conductors.push({
        ...conductor,
        polygon: conductor.polygon.scale(scale, scale),
      })
    }
  }
  for (const pour of circuitJson) {
    if (pour.type !== "pcb_copper_pour" || !pour.source_net_id) continue
    const netId = netForId(pour.source_net_id) ?? pour.source_net_id
    pouredNets.add(netId)
    add({
      polygon: getPourPolygon(pour),
      layers: [pour.layer],
      netId,
      isPour: true,
      pour,
    })
  }
  const components = new Map(
    circuitJson
      .filter((e) => e.type === "pcb_component")
      .map((e) => [e.pcb_component_id, e]),
  )
  if (pouredNets.size > 0) {
    for (const copper of circuitJson) {
      if (copper.type === "pcb_trace") {
        const netId = netForId(copper.pcb_trace_id)
        if (!netId || !pouredNets.has(netId)) continue
        for (let i = 0; i < copper.route.length - 1; i++) {
          const start = copper.route[i]
          const end = copper.route[i + 1]
          const from = getRouteEndpoint(start, "end")
          const to = getRouteEndpoint(end, "start")
          if (from.layer !== to.layer) continue
          const width =
            start.route_type === "via"
              ? end.route_type === "via"
                ? undefined
                : end.width
              : start.width
          if (width === undefined) continue
          const endWidth =
            copper.route_thickness_mode === "interpolated" &&
            end.route_type !== "via"
              ? end.width
              : width
          add({
            polygon: getTraceSegmentPolygon(
              from.point,
              to.point,
              width,
              endWidth,
            ),
            layers: [from.layer],
            netId,
          })
        }
        continue
      }
      if (
        copper.type !== "pcb_smtpad" &&
        copper.type !== "pcb_plated_hole" &&
        copper.type !== "pcb_via"
      )
        continue
      const netId = netForId(getPrimaryId(copper))
      if (!netId || !pouredNets.has(netId)) continue
      if (copper.type === "pcb_smtpad") {
        add({
          polygon: getSmtPadPolygon(copper),
          layers: [copper.layer],
          netId,
          portIds: copper.pcb_port_id ? [copper.pcb_port_id] : [],
          isTerminal: !!copper.pcb_port_id,
        })
      } else if (copper.type === "pcb_plated_hole") {
        add({
          polygon: getPlatedHolePolygon(
            copper,
            copper.pcb_component_id
              ? components.get(copper.pcb_component_id)?.rotation
              : 0,
          ),
          layers: copper.layers,
          netId,
          portIds: copper.pcb_port_id ? [copper.pcb_port_id] : [],
          isTerminal: !!copper.pcb_port_id,
        })
      } else {
        add({
          polygon: getViaPolygon(
            copper,
            copper.outer_diameter,
            copper.hole_diameter,
          ),
          layers: copper.layers,
          netId,
          portIds: copper.pcb_port_ids,
          isTerminal: true,
        })
      }
    }
  }

  const parent = conductors.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const bounds = conductors.map((c) => c.polygon.box)
  const order = conductors
    .map((_, i) => i)
    .sort((a, b) => bounds[a].xmin - bounds[b].xmin)
  for (let a = 0; a < order.length; a++) {
    const i = order[a]
    for (let b = a + 1; b < order.length; b++) {
      const j = order[b]
      if (bounds[j].xmin > bounds[i].xmax + tolerance) break
      if (find(i) === find(j) || conductors[i].netId !== conductors[j].netId)
        continue
      if (
        bounds[j].ymin > bounds[i].ymax + tolerance ||
        bounds[j].ymax < bounds[i].ymin - tolerance
      )
        continue
      if (
        !conductors[i].layers.some((layer) =>
          conductors[j].layers.includes(layer),
        )
      )
        continue
      if (copperPolygonsTouch(conductors[i].polygon, conductors[j].polygon))
        parent[find(j)] = find(i)
    }
  }
  const pourRoots = new Set(
    conductors.flatMap((c, i) => (c.isPour ? [find(i)] : [])),
  )
  const rootsByPort = new Map<PcbPortId, Set<number>>()
  for (const [i, conductor] of conductors.entries()) {
    if (!pourRoots.has(find(i))) continue
    for (const portId of conductor.portIds ?? []) {
      const roots = rootsByPort.get(portId) ?? new Set<number>()
      roots.add(find(i))
      rootsByPort.set(portId, roots)
    }
  }
  const portsByNet = new Map<NetId, PcbPortId[]>()
  for (const port of circuitJson) {
    if (port.type !== "pcb_port") continue
    const netId = netForId(port.pcb_port_id)
    if (!netId || !pouredNets.has(netId)) continue
    const ports = portsByNet.get(netId) ?? []
    ports.push(port.pcb_port_id)
    portsByNet.set(netId, ports)
  }
  const terminalRoots = new Set(
    conductors.flatMap((conductor, i) =>
      conductor.isTerminal ? [find(i)] : [],
    ),
  )
  return {
    getIsolatedPours(): PcbCopperPour[] {
      return conductors.flatMap((conductor, i) =>
        conductor.pour && !terminalRoots.has(find(i)) ? [conductor.pour] : [],
      )
    },
    isPortConnectedToNet(
      portId: PcbPortId,
      sourceNetIds: SourceNet["source_net_id"][],
    ) {
      const roots = rootsByPort.get(portId)
      return sourceNetIds.every((id) =>
        [...(roots ?? [])].some(
          (root) =>
            conductors[root].netId === netForId(id) &&
            // Distinct same-net islands are not a physical connection.
            (portsByNet.get(conductors[root].netId) ?? []).every((peer) =>
              rootsByPort.get(peer)?.has(root),
            ),
        ),
      )
    },
    arePortsConnected(portIds: PcbPortId[]) {
      if (portIds.length < 2) return false
      return [...(rootsByPort.get(portIds[0]) ?? [])].some((root) =>
        portIds.every((id) => rootsByPort.get(id)?.has(root)),
      )
    },
  }
}
