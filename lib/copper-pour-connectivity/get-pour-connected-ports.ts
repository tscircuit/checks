import type { Polygon } from "@flatten-js/core"
import type { AnyCircuitElement, LayerRef, PcbPort } from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import {
  copperPolygonsTouch,
  getPlatedHolePolygon,
  getPourPolygon,
  getSmtPadPolygon,
  getTraceSegmentPolygon,
  getViaPolygon,
} from "./copper-geometry"

type PcbPortId = PcbPort["pcb_port_id"]
type CopperNetId = NonNullable<
  ReturnType<ConnectivityMap["getNetConnectedToId"]>
>

interface Conductor {
  polygon: Polygon
  layers: LayerRef[]
  netId: CopperNetId
  portId?: PcbPortId
  isPour?: boolean
}

/** Build physical copper components on nets with pours. Geometry is board-world
 * mm (+X right, +Y up); only plated holes and vias bridge copper layers.
 * Logical net membership permits a contact, but never creates a physical edge.
 */
export function getPourConnectedPorts(
  circuitJson: AnyCircuitElement[],
  connectivity: ConnectivityMap,
): (ports: PcbPort[]) => boolean {
  const pours = circuitJson.filter((e) => e.type === "pcb_copper_pour")
  const pouredNets = new Set(
    pours.flatMap((pour) =>
      pour.source_net_id
        ? [
            connectivity.getNetConnectedToId(pour.source_net_id) ??
              pour.source_net_id,
          ]
        : [],
    ),
  )
  if (pouredNets.size === 0) return () => false

  const conductors: Conductor[] = []
  const add = (conductor: Conductor) => {
    if (!conductor.polygon.isEmpty()) {
      // Preserve the sub-micron edges emitted by pour clipping under Flatten's
      // absolute epsilon. The contact tolerance below remains 1e-7 mm.
      conductors.push({
        ...conductor,
        polygon: conductor.polygon.scale(1e6, 1e6),
      })
    }
  }
  const components = new Map(
    circuitJson
      .filter((e) => e.type === "pcb_component")
      .map((e) => [e.pcb_component_id, e]),
  )
  for (const pour of pours) {
    if (!pour.source_net_id) continue
    add({
      polygon: getPourPolygon(pour),
      layers: [pour.layer],
      netId:
        connectivity.getNetConnectedToId(pour.source_net_id) ??
        pour.source_net_id,
      isPour: true,
    })
  }
  for (const element of circuitJson) {
    if (element.type === "pcb_smtpad" || element.type === "pcb_plated_hole") {
      if (!element.pcb_port_id) continue
      const netId = connectivity.getNetConnectedToId(element.pcb_port_id)
      if (!netId || !pouredNets.has(netId)) continue
      add({
        polygon:
          element.type === "pcb_smtpad"
            ? getSmtPadPolygon(element)
            : getPlatedHolePolygon(
                element,
                element.pcb_component_id
                  ? components.get(element.pcb_component_id)?.rotation
                  : 0,
              ),
        layers:
          element.type === "pcb_smtpad" ? [element.layer] : element.layers,
        netId,
        portId: element.pcb_port_id,
      })
    } else if (element.type === "pcb_via") {
      const netId = element.source_net_id
        ? (connectivity.getNetConnectedToId(element.source_net_id) ??
          element.source_net_id)
        : connectivity.getNetConnectedToId(element.pcb_via_id)
      if (!netId || !pouredNets.has(netId)) continue
      add({
        polygon: getViaPolygon(
          element,
          element.outer_diameter,
          element.hole_diameter,
        ),
        layers: element.layers,
        netId,
      })
    } else if (element.type === "pcb_trace") {
      const netId = connectivity.getNetConnectedToId(element.pcb_trace_id)
      if (!netId || !pouredNets.has(netId)) continue
      // Do not approximate interpolated copper with constant-width capsules.
      if (element.route_thickness_mode === "interpolated") continue
      for (let i = 0; i < element.route.length - 1; i++) {
        const start = element.route[i]
        const end = element.route[i + 1]
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
  for (let i = 0; i < conductors.length; i++) {
    const conductor = conductors[i]
    for (let j = i + 1; j < conductors.length; j++) {
      const neighbor = conductors[j]
      if (find(i) === find(j) || conductor.netId !== neighbor.netId) continue
      if (!conductor.layers.some((layer) => neighbor.layers.includes(layer)))
        continue
      const a = bounds[i]
      const b = bounds[j]
      if (
        a.xmax + 0.1 < b.xmin ||
        b.xmax + 0.1 < a.xmin ||
        a.ymax + 0.1 < b.ymin ||
        b.ymax + 0.1 < a.ymin
      )
        continue
      if (copperPolygonsTouch(conductor.polygon, neighbor.polygon, 0.1))
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
  // A same-net island containing only one of several required pads is still
  // disconnected. All requested ports must reach a common poured component.
  return (ports) =>
    ports.length > 0 &&
    [...(rootsByPort.get(ports[0].pcb_port_id) ?? [])].some((root) =>
      ports.every((port) => rootsByPort.get(port.pcb_port_id)?.has(root)),
    )
}
