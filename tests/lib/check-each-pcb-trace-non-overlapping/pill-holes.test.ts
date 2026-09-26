import { expect, test } from "bun:test"
import type { PcbHole, PcbTrace } from "circuit-json"
import { checkHoleTraceClearance } from "../../../lib/check-hole-trace-clearance"
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

test("pill hole: straight edge overlap", () => {
  const trace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "trace",
    route: [
      { route_type: "wire", x: 0, y: 1, width: 0.2, layer: "bottom" },
      { route_type: "wire", x: 0.1, y: 1, width: 0.2, layer: "bottom" },
    ],
  }
  const errors = checkEachPcbTraceNonOverlapping([trace, horizontalSlot], {
    minClearance: 0.1,
  })
  expect(errors).toHaveLength(1)
})

test("pill hole: straight edge clearance", () => {
  const trace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "trace",
    route: [
      { route_type: "wire", x: 0, y: 1.15, width: 0.2, layer: "bottom" },
      { route_type: "wire", x: 0.1, y: 1.15, width: 0.2, layer: "bottom" },
    ],
  }
  const errors = checkHoleTraceClearance([trace, horizontalSlot], {
    minClearance: 0.1,
  })
  expect(errors).toHaveLength(1)
})

test("pill hole: clear straight edge", () => {
  const trace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "trace",
    route: [
      { route_type: "wire", x: 0, y: 1.3, width: 0.2, layer: "bottom" },
      { route_type: "wire", x: 0.1, y: 1.3, width: 0.2, layer: "bottom" },
    ],
  }
  const errors = checkHoleTraceClearance([trace, horizontalSlot], {
    minClearance: 0.1,
  })
  expect(errors).toHaveLength(0)
})

test("pill hole: exact required clearance", () => {
  const trace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "trace",
    route: [
      { route_type: "wire", x: 0, y: 1.2, width: 0.2, layer: "bottom" },
      { route_type: "wire", x: 0.1, y: 1.2, width: 0.2, layer: "bottom" },
    ],
  }
  const errors = checkHoleTraceClearance([trace, horizontalSlot], {
    minClearance: 0.1,
  })
  expect(errors).toHaveLength(0)
})

test("pill hole: equal dimensions form a circle", () => {
  const trace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "trace",
    route: [
      { route_type: "wire", x: 0.9, y: 0.9, width: 0.2, layer: "bottom" },
      { route_type: "wire", x: 1, y: 0.9, width: 0.2, layer: "bottom" },
    ],
  }
  const errors = checkHoleTraceClearance(
    [trace, { ...horizontalSlot, hole_width: 2 }],
    {
      minClearance: 0.1,
    },
  )
  expect(errors).toHaveLength(0)
})

test("pill hole: translated rotated slot overlap", () => {
  const trace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "trace",
    route: [
      { route_type: "wire", x: 10, y: 11.8, width: 0.2, layer: "bottom" },
      { route_type: "wire", x: 10.1, y: 11.8, width: 0.2, layer: "bottom" },
    ],
  }
  const errors = checkEachPcbTraceNonOverlapping(
    [
      trace,
      {
        ...horizontalSlot,
        hole_shape: "rotated_pill",
        ccw_rotation: 90,
        x: 10,
        y: 10,
      },
    ],
    {
      minClearance: 0.1,
    },
  )
  expect(errors).toHaveLength(1)
})

test("pill hole: rounded end overlap", () => {
  const trace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "trace",
    route: [
      { route_type: "wire", x: 1.7, y: 0.6, width: 0.2, layer: "bottom" },
      { route_type: "wire", x: 1.8, y: 0.6, width: 0.2, layer: "bottom" },
    ],
  }
  const errors = checkEachPcbTraceNonOverlapping([trace, horizontalSlot], {
    minClearance: 0.1,
  })
  expect(errors).toHaveLength(1)
})

test("pill hole: clear rounded corner inside bounds", () => {
  const trace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "trace",
    route: [
      { route_type: "wire", x: 1.9, y: 0.9, width: 0.2, layer: "bottom" },
      { route_type: "wire", x: 2, y: 0.9, width: 0.2, layer: "bottom" },
    ],
  }
  const errors = checkHoleTraceClearance([trace, horizontalSlot], {
    minClearance: 0.1,
  })
  expect(errors).toHaveLength(0)
})

test("pill hole: vertical slot overlap", () => {
  const trace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "trace",
    route: [
      { route_type: "wire", x: 0, y: 1.8, width: 0.2, layer: "bottom" },
      { route_type: "wire", x: 0.1, y: 1.8, width: 0.2, layer: "bottom" },
    ],
  }
  const errors = checkEachPcbTraceNonOverlapping(
    [trace, { ...horizontalSlot, hole_width: 2, hole_height: 4 }],
    {
      minClearance: 0.1,
    },
  )
  expect(errors).toHaveLength(1)
})

test("pill hole: rotated slot overlap", () => {
  const trace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "trace",
    route: [
      { route_type: "wire", x: 1.2, y: 1.2, width: 0.2, layer: "bottom" },
      { route_type: "wire", x: 1.3, y: 1.2, width: 0.2, layer: "bottom" },
    ],
  }
  const errors = checkEachPcbTraceNonOverlapping(
    [
      trace,
      { ...horizontalSlot, hole_shape: "rotated_pill", ccw_rotation: 45 },
    ],
    {
      minClearance: 0.1,
    },
  )
  expect(errors).toHaveLength(1)
})

test("pill hole: clear rotated slot bounding box", () => {
  const trace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "trace",
    route: [
      { route_type: "wire", x: -1.5, y: 1.5, width: 0.2, layer: "bottom" },
      { route_type: "wire", x: -1.4, y: 1.5, width: 0.2, layer: "bottom" },
    ],
  }
  const errors = checkHoleTraceClearance(
    [
      trace,
      { ...horizontalSlot, hole_shape: "rotated_pill", ccw_rotation: 45 },
    ],
    {
      minClearance: 0.1,
    },
  )
  expect(errors).toHaveLength(0)
})
