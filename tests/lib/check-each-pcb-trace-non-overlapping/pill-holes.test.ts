import { expect, test } from "bun:test"
import type { PcbHole, PcbTrace } from "circuit-json"
import { checkEachPcbTraceNonOverlapping } from "../../../lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"

const horizontalSlot: PcbHole = {
  type: "pcb_hole",
  pcb_hole_id: "slot",
  hole_shape: "pill",
  hole_width: 4,
  hole_height: 2,
  x: 0,
  y: 0,
}

test.each([
  { name: "straight edge overlap", hole: horizontalSlot, x: 0, y: 1, count: 1 },
  {
    name: "straight edge clearance",
    hole: horizontalSlot,
    x: 0,
    y: 1.15,
    count: 1,
  },
  { name: "clear straight edge", hole: horizontalSlot, x: 0, y: 1.3, count: 0 },
  {
    name: "rounded end overlap",
    hole: horizontalSlot,
    x: 1.7,
    y: 0.6,
    count: 1,
  },
  {
    name: "clear rounded corner inside bounds",
    hole: horizontalSlot,
    x: 1.9,
    y: 0.9,
    count: 0,
  },
  {
    name: "vertical slot overlap",
    hole: { ...horizontalSlot, hole_width: 2, hole_height: 4 },
    x: 0,
    y: 1.8,
    count: 1,
  },
  {
    name: "rotated slot overlap",
    hole: { ...horizontalSlot, hole_shape: "rotated_pill", ccw_rotation: 45 },
    x: 1.2,
    y: 1.2,
    count: 1,
  },
  {
    name: "clear rotated slot bounding box",
    hole: { ...horizontalSlot, hole_shape: "rotated_pill", ccw_rotation: 45 },
    x: -1.5,
    y: 1.5,
    count: 0,
  },
] satisfies {
  name: string
  hole: PcbHole
  x: number
  y: number
  count: number
}[])("pill hole: $name", ({ hole, x, y, count }) => {
  const trace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "trace",
    route: [
      { route_type: "wire", x, y, width: 0.2, layer: "bottom" },
      { route_type: "wire", x: x + 0.1, y, width: 0.2, layer: "bottom" },
    ],
  }
  const errors = checkEachPcbTraceNonOverlapping([trace, hole], {
    minClearance: 0.1,
  })
  expect(errors).toHaveLength(count)
})
