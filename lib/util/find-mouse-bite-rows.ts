import { Point, Polygon, Segment, Vector } from "@flatten-js/core"
import type { PcbHole } from "circuit-json"

/** Circuit-world geometry in mm, +X right/+Y up. Positions are points; the
 * tangent and normal are unit directions. Only straight, regularly pitched
 * rows of at least two small circular NPTH drills beside routing slots qualify.
 */
export function findMouseBiteRows(holes: PcbHole[], slots: Polygon[]) {
  const drills = holes.flatMap((hole) =>
    hole.hole_shape === "circle" && hole.hole_diameter <= 1.2
      ? [{ hole, point: new Point(hole.x, hole.y) }]
      : [],
  )
  const used = new Set<PcbHole["pcb_hole_id"]>()
  const rows: {
    holes: PcbHole[]
    band: Polygon
    probes: [Point, Point][]
    normal: Vector
  }[] = []
  for (const start of drills) {
    if (used.has(start.hole.pcb_hole_id)) continue
    for (const next of drills) {
      if (next === start || used.has(next.hole.pcb_hole_id)) continue
      const diameter = start.hole.hole_diameter
      if (Math.abs(next.hole.hole_diameter - diameter) > 1e-6) continue
      const pitch = start.point.distanceTo(next.point)[0]
      if (pitch <= diameter + 0.05 || pitch > diameter * 2.2) continue
      const tangent = new Vector(start.point, next.point).normalize()
      const aligned = drills
        .filter((drill) => !used.has(drill.hole.pcb_hole_id))
        .filter((drill) => Math.abs(drill.hole.hole_diameter - diameter) < 1e-6)
        .map((drill) => ({
          ...drill,
          distance: new Vector(start.point, drill.point).dot(tangent),
          offset: Math.abs(new Vector(start.point, drill.point).cross(tangent)),
        }))
        .filter((drill) => drill.offset < 0.01)
        .sort((a, b) => a.distance - b.distance)
      // Split collinear but widely separated tabs into separate rows.
      const startIndex = aligned.findIndex((drill) => drill.hole === start.hole)
      let first = startIndex
      let last = startIndex
      while (
        first > 0 &&
        Math.abs(
          aligned[first]!.distance - aligned[first - 1]!.distance - pitch,
        ) < 0.02
      )
        first--
      while (
        last + 1 < aligned.length &&
        Math.abs(
          aligned[last + 1]!.distance - aligned[last]!.distance - pitch,
        ) < 0.02
      )
        last++
      const row = aligned.slice(first, last + 1)
      if (row.length < 2) continue
      const a = row[0]!.point.translate(tangent.multiply(-diameter))
      const b = row.at(-1)!.point.translate(tangent.multiply(diameter))
      // Both ends must meet routed slots; ordinary mechanical drill rows are
      // not evidence of breakaway tabs.
      if (
        ![a, b].every((end) =>
          slots.some(
            (slot) =>
              slot.contains(end) || end.distanceTo(slot)[0] < diameter / 2,
          ),
        )
      )
        continue
      const normal = tangent.rotate90CCW()
      const halfWidth = diameter / 2 + 0.02
      const band = new Polygon([
        a.translate(normal.multiply(halfWidth)),
        b.translate(normal.multiply(halfWidth)),
        b.translate(normal.multiply(-halfWidth)),
        a.translate(normal.multiply(-halfWidth)),
      ])
      band.reverse() // Boolean operations require CCW outer contours.
      // Probe through a web BETWEEN holes, not through a drill at the row center.
      const offset = normal.multiply(halfWidth + 0.02)
      rows.push({
        holes: row.map((drill) => drill.hole),
        band,
        probes: row.slice(1).map((drill, index): [Point, Point] => {
          const web = new Segment(row[index]!.point, drill.point).middle()
          return [web.translate(offset), web.translate(offset.multiply(-1))]
        }),
        normal,
      })
      for (const drill of row) used.add(drill.hole.pcb_hole_id)
      break
    }
  }
  return rows
}
