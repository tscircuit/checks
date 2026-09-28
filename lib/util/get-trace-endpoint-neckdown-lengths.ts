import { Point, Segment } from "@flatten-js/core"
import { convertCircuitJsonToFlattenJs } from "@tscircuit/circuit-json-to-flattenjs"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import type { PadElement } from "lib/check-pad-clearance/common"

/**
 * Lengths of each wire segment covered by a connected endpoint pad or its
 * bounded escape. Board-world points in mm (+X right, +Y up); lengths follow
 * the route, not straight-line distance to a pad. Only the initial pad exit
 * starts an escape budget: bends, extra points and re-entry cannot reset it.
 */
export function getTraceEndpointNeckdownLengths(
  trace: PcbTrace,
  circuitJson: AnyCircuitElement[],
  maxEscapeLength: number,
) {
  const fromStart = new Map<number, number>()
  const fromEnd = new Map<number, number>()
  for (const reverse of [false, true]) {
    const endpoint = trace.route[reverse ? trace.route.length - 1 : 0]
    if (endpoint?.route_type !== "wire") continue
    const portId = reverse
      ? endpoint.end_pcb_port_id
      : endpoint.start_pcb_port_id
    if (!portId) continue
    const pads = circuitJson.filter(
      (element): element is PadElement =>
        (element.type === "pcb_smtpad" || element.type === "pcb_plated_hole") &&
        element.pcb_port_id === portId,
    )
    if (!pads.length) continue
    const geometry = convertCircuitJsonToFlattenJs(circuitJson, {
      elementIds: pads.map((pad) =>
        pad.type === "pcb_smtpad" ? pad.pcb_smtpad_id : pad.pcb_plated_hole_id,
      ),
      layers: [endpoint.layer],
      roles: ["copper"],
      includeDrillHoles: false,
    })
    if (geometry.warnings.length) continue
    const shapes = geometry.elements.flatMap((element) => element.shapes)
    const contains = (point: Point) =>
      shapes.some((shape) => shape.contains(point))
    if (!contains(new Point(endpoint.x, endpoint.y))) continue

    let insidePad = true
    let remainingEscape = maxEscapeLength
    const lengths = reverse ? fromEnd : fromStart
    for (
      let i = reverse ? trace.route.length - 2 : 0;
      i >= 0 && i < trace.route.length - 1;
      i += reverse ? -1 : 1
    ) {
      const a = trace.route[reverse ? i + 1 : i]
      const b = trace.route[reverse ? i : i + 1]
      if (
        a.route_type !== "wire" ||
        b.route_type !== "wire" ||
        a.layer !== endpoint.layer ||
        b.layer !== endpoint.layer
      )
        break
      const start = new Point(a.x, a.y)
      const end = new Point(b.x, b.y)
      const segment = new Segment(start, end)
      const length = segment.length
      if (length === 0) continue
      let covered = 0
      if (insidePad) {
        const cuts = [
          0,
          length,
          ...shapes.flatMap((shape) =>
            shape.intersect(segment).map((point) => start.distanceTo(point)[0]),
          ),
        ].sort((a, b) => a - b)
        for (let j = 0; j < cuts.length - 1; j++) {
          if (cuts[j + 1] - cuts[j] < 1e-9) continue
          const fraction = (cuts[j] + cuts[j + 1]) / (2 * length)
          if (
            !contains(
              new Point(
                a.x + (b.x - a.x) * fraction,
                a.y + (b.y - a.y) * fraction,
              ),
            )
          ) {
            insidePad = false
            break
          }
          covered = cuts[j + 1]
        }
      }
      const escape = Math.min(length - covered, remainingEscape)
      covered += escape
      remainingEscape -= escape
      lengths.set(i, covered)
      if (covered < length) break
    }
  }
  return { fromStart, fromEnd }
}
