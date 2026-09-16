import type { Polygon } from "@flatten-js/core"
import type {
  AnyCircuitElement,
  LayerRef,
  PcbPort,
  SourceNet,
} from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import {
  getPrimaryId,
  copperPolygonsTouch,
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
  portId?: PcbPortId
  isPour?: boolean
}

/** Physical pour connectivity in board-world mm (+X right, +Y up).
 * Only touching copper on a common layer forms an edge. Plated pads and vias
 * bridge their emitted layers; logical net membership never joins islands.
 * Constant-width wire copper can connect pours. Interpolated traces and inline
 * via inference are left to the existing trace checks; emitted barrels bridge layers.
 */
export function getCopperPourConnectivity(
  circuitJson: AnyCircuitElement[],
  connectivity: ConnectivityMap,
) {
  // Scale before geometric predicates to preserve tiny edges in solver BReps.
  const scale = 1e6
  const tolerance = 1e-7 * scale
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
    const netId = netForId(pour.source_net_id)
    if (!netId) continue
    pouredNets.add(netId)
    add({
      polygon: getPourPolygon(pour),
      layers: [pour.layer],
      netId,
      isPour: true,
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
        if (
          !netId ||
          !pouredNets.has(netId) ||
          copper.route_thickness_mode === "interpolated"
        )
          continue
        for (let i = 0; i < copper.route.length - 1; i++) {
          const start = copper.route[i]
          const end = copper.route[i + 1]
          if (
            start.route_type !== "wire" ||
            end.route_type !== "wire" ||
            start.layer !== end.layer
          )
            continue
          add({
            polygon: getTraceSegmentPolygon(start, end, start.width),
            layers: [start.layer],
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
          portId: copper.pcb_port_id,
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
          portId: copper.pcb_port_id,
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
      if (
        copperPolygonsTouch(
          conductors[i].polygon,
          conductors[j].polygon,
          tolerance,
        )
      )
        parent[find(j)] = find(i)
    }
  }
  const pourRoots = new Set(
    conductors.flatMap((c, i) => (c.isPour ? [find(i)] : [])),
  )
  const rootsByPort = new Map<PcbPortId, Set<number>>()
  for (const [i, conductor] of conductors.entries()) {
    if (!conductor.portId || !pourRoots.has(find(i))) continue
    const roots = rootsByPort.get(conductor.portId) ?? new Set<number>()
    roots.add(find(i))
    rootsByPort.set(conductor.portId, roots)
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
  return {
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
