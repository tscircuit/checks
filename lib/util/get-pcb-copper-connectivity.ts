import { all_layers, type AnyCircuitElement, type LayerRef } from "circuit-json"
import type { Polygon } from "@flatten-js/core"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import {
  circlePolygon,
  getPlatedHolePolygon,
  getPourPolygon,
  getSmtPadPolygon,
  getTraceSegmentPolygon,
  getViaPolygon,
} from "@tscircuit/circuit-json-util"
import Flatbush from "flatbush"
import { createCopperPolygonContactTester } from "../copper-pour-connectivity/create-copper-polygon-contact-tester"

type NetId = NonNullable<ReturnType<ConnectivityMap["getNetConnectedToId"]>>
interface Conductor {
  polygon: Polygon
  layers: LayerRef[]
  netId?: NetId
  portIds?: string[]
  isPour?: boolean
}
type UnsupportedBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  layers: LayerRef[]
}

/** Copper in board-world mm. Only touching polygons on a common layer join
 * physical islands, independently of source membership. Segments
 * remain separate vertices; route IDs and via ownership never create edges. */
export function getPcbCopperConnectivity(
  circuit: AnyCircuitElement[],
  connectivity: ConnectivityMap,
  {
    netIds,
    includeInlineVias = true,
    restrictToSameNet = false,
  }: {
    netIds?: Set<NetId>
    includeInlineVias?: boolean
    restrictToSameNet?: boolean
  } = {},
) {
  const scale = 1e6
  const tolerance = 1e-7 * scale
  const touches = createCopperPolygonContactTester(tolerance)
  const conductors: Conductor[] = []
  const unsupportedNetIds = new Set<NetId>()
  const unsupportedBounds: UnsupportedBounds[] = []
  const netForId = (id: string | undefined) =>
    id ? connectivity.getNetConnectedToId(id) : undefined
  const ports = new Map(
    circuit.filter((e) => e.type === "pcb_port").map((e) => [e.pcb_port_id, e]),
  )
  const traces = new Map(
    circuit
      .filter((e) => e.type === "pcb_trace")
      .map((e) => [e.pcb_trace_id, e]),
  )
  const components = new Map(
    circuit
      .filter((e) => e.type === "pcb_component")
      .map((e) => [e.pcb_component_id, e]),
  )
  const netForPort = (id: string | undefined) =>
    netForId(id ? ports.get(id)?.source_port_id : undefined) ?? netForId(id)
  const netForTrace = (id: string | undefined) =>
    netForId(id ? traces.get(id)?.source_trace_id : undefined) ?? netForId(id)
  const add = (conductor: Conductor) => {
    if (
      (!netIds || (conductor.netId && netIds.has(conductor.netId))) &&
      !conductor.polygon.isEmpty()
    )
      conductors.push({
        ...conductor,
        polygon: conductor.polygon.scale(scale, scale),
      })
  }
  const vias = circuit.filter((e) => e.type === "pcb_via")
  const padPortIds = new Set(
    circuit.flatMap((e) =>
      (e.type === "pcb_smtpad" || e.type === "pcb_plated_hole") && e.pcb_port_id
        ? [e.pcb_port_id]
        : [],
    ),
  )
  const modeledPortIds = new Set([
    ...padPortIds,
    ...vias.flatMap((v) => v.pcb_port_ids ?? []),
  ])
  const board = circuit.find((e) => e.type === "pcb_board")
  const stack: LayerRef[] = [
    "top",
    ...all_layers
      .filter((l) => l.startsWith("inner"))
      .slice(0, board ? Math.max(0, board.num_layers - 2) : undefined),
    ...(board?.num_layers === 1 ? [] : (["bottom"] as const)),
  ]
  const wirePolygon = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    width: number,
  ) =>
    Math.hypot(start.x - end.x, start.y - end.y) <= 1e-9
      ? circlePolygon(start, width / 2)
      : getTraceSegmentPolygon(start, end, width)
  for (const copper of circuit) {
    if (copper.type === "pcb_copper_pour") {
      const netId = netForId(copper.source_net_id)
      add({
        polygon: getPourPolygon(copper),
        layers: [copper.layer],
        netId,
        isPour: true,
      })
    } else if (
      copper.type === "pcb_smtpad" ||
      copper.type === "pcb_plated_hole"
    ) {
      const netId =
        netForPort(copper.pcb_port_id) ??
        netForId(
          copper.type === "pcb_smtpad"
            ? copper.pcb_smtpad_id
            : copper.pcb_plated_hole_id,
        )
      let polygon: Polygon
      if (copper.type === "pcb_smtpad") polygon = getSmtPadPolygon(copper)
      else {
        const pad = { hole_offset_x: 0, hole_offset_y: 0, ...copper }
        polygon = getPlatedHolePolygon(
          pad,
          copper.pcb_component_id
            ? components.get(copper.pcb_component_id)?.rotation
            : 0,
        )
      }
      add({
        polygon,
        layers: copper.type === "pcb_smtpad" ? [copper.layer] : copper.layers,
        netId,
        portIds: copper.pcb_port_id ? [copper.pcb_port_id] : [],
      })
    } else if (copper.type === "pcb_via") {
      const netId =
        netForId(copper.source_net_id) ??
        netForId(copper.source_trace_id) ??
        netForTrace(copper.pcb_trace_id) ??
        copper.pcb_port_ids?.map(netForPort).find(Boolean) ??
        netForId(copper.pcb_via_id)
      add({
        polygon: getViaPolygon(
          copper,
          copper.outer_diameter,
          copper.hole_diameter,
        ),
        layers: copper.layers,
        netId,
        // Pad-backed ports attach by copper contact. Manual via ports have
        // no pad, so their emitted position and layer qualify the alias.
        portIds: restrictToSameNet
          ? copper.pcb_port_ids
          : copper.pcb_port_ids?.filter((id) => {
              const port = ports.get(id)
              return (
                !padPortIds.has(id) &&
                port &&
                port.layers.some((l) => copper.layers.includes(l)) &&
                Math.hypot(port.x - copper.x, port.y - copper.y) <=
                  copper.outer_diameter / 2 + 1e-9
              )
            }),
      })
    } else if (copper.type === "pcb_trace") {
      const netId =
        netForId(copper.source_trace_id) ?? netForId(copper.pcb_trace_id)
      if (netIds && (!netId || !netIds.has(netId))) continue
      const unsupported =
        copper.route_thickness_mode === "interpolated" ||
        copper.route.some(
          (p) =>
            p.route_type === "through_pad" ||
            (p.route_type === "wire" &&
              p.width_interpolation_mode !== undefined),
        )
      const markUnsupported = () => {
        if (netId) unsupportedNetIds.add(netId)
        else {
          const points = copper.route.flatMap((p) =>
            p.route_type === "through_pad" ? [p.start, p.end] : [p],
          )
          if (!points.length) return
          const radius =
            Math.max(
              0,
              ...copper.route.map((p) =>
                p.route_type === "via" ? (p.outer_diameter ?? 0) : p.width,
              ),
            ) / 2
          const layers = [
            ...new Set(
              copper.route.flatMap((p) =>
                p.route_type === "wire"
                  ? [p.layer]
                  : p.route_type === "through_pad"
                    ? [p.start_layer, p.end_layer]
                    : stack.slice(
                        Math.min(
                          stack.indexOf(p.from_layer),
                          stack.indexOf(p.to_layer),
                        ),
                        Math.max(
                          stack.indexOf(p.from_layer),
                          stack.indexOf(p.to_layer),
                        ) + 1,
                      ),
              ),
            ),
          ]
          unsupportedBounds.push({
            minX: (Math.min(...points.map((p) => p.x)) - radius) * scale,
            minY: (Math.min(...points.map((p) => p.y)) - radius) * scale,
            maxX: (Math.max(...points.map((p) => p.x)) + radius) * scale,
            maxY: (Math.max(...points.map((p) => p.y)) + radius) * scale,
            layers,
          })
        }
      }
      if (unsupported) markUnsupported()
      if (copper.route_thickness_mode === "interpolated") continue
      for (const [i, point] of copper.route.entries()) {
        const next = copper.route[i + 1]
        if (
          point.route_type === "wire" &&
          next?.route_type === "wire" &&
          point.layer === next.layer
        ) {
          add({
            polygon: wirePolygon(point, next, point.width),
            layers: [point.layer],
            netId,
          })
        } else if (
          includeInlineVias &&
          point.route_type === "wire" &&
          next?.route_type === "via" &&
          point.layer === next.from_layer
        ) {
          add({
            polygon: wirePolygon(point, next, point.width),
            layers: [point.layer],
            netId,
          })
        } else if (
          includeInlineVias &&
          point.route_type === "via" &&
          next?.route_type === "wire" &&
          point.to_layer === next.layer
        ) {
          add({
            polygon: wirePolygon(point, next, next.width),
            layers: [next.layer],
            netId,
          })
        }
        if (!includeInlineVias || point.route_type !== "via") continue
        // An emitted barrel is authoritative, including its actual layer span.
        if (vias.some((v) => Math.hypot(v.x - point.x, v.y - point.y) <= 1e-9))
          continue
        const from = stack.indexOf(point.from_layer),
          to = stack.indexOf(point.to_layer)
        if (from < 0 || to < 0 || !point.outer_diameter) {
          markUnsupported()
          continue
        }
        add({
          polygon: getViaPolygon(
            point,
            point.outer_diameter,
            point.hole_diameter ?? 0,
          ),
          layers: stack.slice(Math.min(from, to), Math.max(from, to) + 1),
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
  if (conductors.length) {
    const index = new Flatbush(conductors.length)
    for (const { polygon } of conductors) {
      const b = polygon.box
      index.add(b.xmin, b.ymin, b.xmax, b.ymax)
    }
    index.finish()
    for (const [i, a] of conductors.entries()) {
      const b = a.polygon.box
      for (const j of index.search(
        b.xmin - tolerance,
        b.ymin - tolerance,
        b.xmax + tolerance,
        b.ymax + tolerance,
      )) {
        const other = conductors[j]
        if (
          j <= i ||
          find(i) === find(j) ||
          (restrictToSameNet && a.netId !== other.netId) ||
          !a.layers.some((l) => other.layers.includes(l))
        )
          continue
        if (touches(a.polygon, other.polygon)) parent[find(j)] = find(i)
      }
    }
    const netsByRoot = new Map<number, Set<NetId>>()
    for (const [i, conductor] of conductors.entries()) {
      if (!conductor.netId) continue
      const root = find(i),
        nets = netsByRoot.get(root) ?? new Set<NetId>()
      nets.add(conductor.netId)
      netsByRoot.set(root, nets)
    }
    for (const box of unsupportedBounds) {
      for (const i of index.search(
        box.minX - tolerance,
        box.minY - tolerance,
        box.maxX + tolerance,
        box.maxY + tolerance,
      )) {
        if (!box.layers.some((l) => conductors[i].layers.includes(l))) continue
        for (const netId of netsByRoot.get(find(i)) ?? [])
          unsupportedNetIds.add(netId)
      }
    }
  }
  const pourRoots = new Set<number>()
  const netIdByRoot = new Map<number, NetId>()
  const rootsByPort = new Map<string, Set<number>>()
  for (const [i, conductor] of conductors.entries()) {
    const root = find(i)
    if (conductor.netId) netIdByRoot.set(root, conductor.netId)
    if (conductor.isPour) pourRoots.add(root)
    for (const portId of conductor.portIds ?? []) {
      const roots = rootsByPort.get(portId) ?? new Set<number>()
      roots.add(root)
      rootsByPort.set(portId, roots)
    }
  }
  const unsupportedPortIds = new Set(
    [...ports.keys()].filter((id) => !modeledPortIds.has(id)),
  )
  return {
    rootsByPort,
    pourRoots,
    netIdByRoot,
    unsupportedNetIds,
    unsupportedPortIds,
  }
}
