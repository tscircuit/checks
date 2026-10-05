import type { Polygon } from "@flatten-js/core"
import { all_layers, type AnyCircuitElement, type PcbVia } from "circuit-json"
import {
  circlePolygon,
  getPlatedHolePolygon,
  getPourPolygon,
  getTraceSegmentPolygon,
} from "@tscircuit/circuit-json-util"
import Flatbush from "flatbush"
import { createCopperPolygonContactTester } from "../copper-pour-connectivity/create-copper-polygon-contact-tester"

type Conductor = {
  id: string
  layers: string[]
  polygon: Polygon
  bridges: boolean
  platedPort: boolean
}

/** Add physical barrel/pour edges in board-world mm. Logical net membership
 * never joins copper; holes in pours and the emitted via layer span are retained.
 * Wire/wire intersections remain handled by the existing trace index.
 * Plated ports attach only through direct trace/annulus contact, bridging their
 * declared layers. Pour-only pad connections stay in the dedicated checks so
 * an isolated pour and its trace stub cannot satisfy a named-net port.
 */
export function getViaAndPourConnections(
  circuit: AnyCircuitElement[],
): string[][] {
  if (
    !circuit.some(
      (e) =>
        e.type === "pcb_via" ||
        e.type === "pcb_plated_hole" ||
        e.type === "pcb_copper_pour" ||
        (e.type === "pcb_trace" && e.route.some((p) => p.route_type === "via")),
    )
  )
    return []
  const conductors: Conductor[] = []
  const connections: string[][] = []
  const scale = 1e6
  const tolerance = 1e-7 * scale
  const touches = createCopperPolygonContactTester(tolerance)
  const add = (
    id: string,
    layers: string[],
    polygon: Polygon,
    bridges = false,
    platedPort = false,
  ) => {
    if (!polygon.isEmpty())
      conductors.push({
        id,
        layers,
        polygon: polygon.scale(scale, scale),
        bridges,
        platedPort,
      })
  }
  const vias = circuit.filter((e) => e.type === "pcb_via")
  const components = new Map(
    circuit
      .filter((e) => e.type === "pcb_component")
      .map((e) => [e.pcb_component_id, e]),
  )
  const board = circuit.find((e) => e.type === "pcb_board")
  const stack = [
    "top",
    ...all_layers
      .filter((l) => l.startsWith("inner"))
      .slice(0, board ? Math.max(0, board.num_layers - 2) : undefined),
    ...(board?.num_layers === 1 ? [] : ["bottom"]),
  ]
  for (const copper of circuit) {
    if (copper.type === "pcb_via") {
      add(
        copper.pcb_via_id,
        copper.layers,
        circlePolygon(copper, copper.outer_diameter / 2),
        true,
      )
      if (copper.pcb_trace_id)
        connections.push([copper.pcb_via_id, copper.pcb_trace_id])
    } else if (copper.type === "pcb_plated_hole") {
      if (!copper.pcb_port_id) continue
      // Historical circular-hole/rect-pad records omit centered offsets.
      const pad = { hole_offset_x: 0, hole_offset_y: 0, ...copper }
      add(
        copper.pcb_port_id,
        copper.layers,
        getPlatedHolePolygon(
          pad,
          copper.pcb_component_id
            ? components.get(copper.pcb_component_id)?.rotation
            : 0,
        ),
        true,
        true,
      )
    } else if (copper.type === "pcb_copper_pour") {
      add(
        copper.pcb_copper_pour_id,
        [copper.layer],
        getPourPolygon(copper),
        true,
      )
    } else if (copper.type === "pcb_trace") {
      if (copper.route_thickness_mode === "interpolated") continue
      for (let i = 0; i < copper.route.length; i++) {
        const a = copper.route[i],
          b = copper.route[i + 1]
        if (
          a.route_type === "wire" &&
          b?.route_type === "wire" &&
          a.layer === b.layer &&
          (a.x !== b.x || a.y !== b.y)
        ) {
          add(
            copper.pcb_trace_id,
            [a.layer],
            getTraceSegmentPolygon(a, b, a.width),
          )
        } else if (a.route_type === "via") {
          // A materialized via is authoritative (especially for blind/buried spans).
          if (
            vias.some(
              (v) =>
                v.pcb_trace_id === copper.pcb_trace_id &&
                Math.hypot(v.x - a.x, v.y - a.y) < 1e-9,
            )
          )
            continue
          const from = stack.indexOf(a.from_layer),
            to = stack.indexOf(a.to_layer)
          if (from < 0 || to < 0 || !a.outer_diameter) continue
          const via = {
            type: "pcb_via",
            pcb_via_id: `${copper.pcb_trace_id}_via_${i}`,
            x: a.x,
            y: a.y,
            outer_diameter: a.outer_diameter,
            hole_diameter: 0,
            layers: stack.slice(Math.min(from, to), Math.max(from, to) + 1),
          } as PcbVia
          add(
            copper.pcb_trace_id,
            via.layers,
            circlePolygon(via, via.outer_diameter / 2),
            true,
          )
        }
      }
    }
  }
  if (!conductors.length) return connections
  const index = new Flatbush(conductors.length)
  for (const { polygon } of conductors) {
    const b = polygon.box
    index.add(b.xmin, b.ymin, b.xmax, b.ymax)
  }
  index.finish()
  for (const [i, a] of conductors.entries()) {
    if (!a.bridges) continue
    const box = a.polygon.box
    for (const j of index.search(
      box.xmin - tolerance,
      box.ymin - tolerance,
      box.xmax + tolerance,
      box.ymax + tolerance,
    )) {
      const b = conductors[j]
      if (
        (a.platedPort && b.bridges) ||
        (b.platedPort && a.bridges) ||
        i === j ||
        a.id === b.id ||
        (b.bridges && j < i) ||
        !a.layers.some((l) => b.layers.includes(l))
      )
        continue
      if (touches(a.polygon, b.polygon)) connections.push([a.id, b.id])
    }
  }
  return connections
}
