import { expect, test } from "bun:test"
import type { PcbBoard, PcbTrace, PcbTraceRoutePointWire } from "circuit-json"
import { checkPcbTracesOutOfBoard, runAllRoutingChecks } from "../../.."

const board: PcbBoard = {
  type: "pcb_board",
  pcb_board_id: "board",
  center: { x: 0, y: 0 },
  width: 10,
  height: 10,
  num_layers: 2,
  thickness: 1.6,
  material: "fr4",
  min_board_edge_clearance: 0.2,
}

const wire = (
  point: Pick<PcbTraceRoutePointWire, "x" | "y"> & { width?: number },
): PcbTraceRoutePointWire => ({
  route_type: "wire",
  layer: "top",
  width: 0.2,
  ...point,
})

const trace = (
  route: PcbTrace["route"],
  overrides: Partial<PcbTrace> = {},
): PcbTrace => ({
  type: "pcb_trace",
  pcb_trace_id: "trace",
  source_trace_id: "source_trace",
  route,
  ...overrides,
})

test.each([
  [
    { x: 8, y: -1 },
    { x: 8, y: 1 },
  ],
  [
    { x: -8, y: -1 },
    { x: -8, y: 1 },
  ],
  [
    { x: -1, y: 8 },
    { x: 1, y: 8 },
  ],
  [
    { x: -1, y: -8 },
    { x: 1, y: -8 },
  ],
])("rejects traces wholly outside each board edge: %j", (start, end) => {
  const errors = checkPcbTracesOutOfBoard([
    board,
    trace([wire(start), wire(end)]),
  ])
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_trace_id).toBe("trace")
  expect(errors[0].message).toContain("outside")
})

test("uses a translated board's position and accepts the equivalent inside trace", () => {
  const shiftedBoard = { ...board, center: { x: 20, y: -10 } }
  expect(
    checkPcbTracesOutOfBoard([
      shiftedBoard,
      trace([wire({ x: 0, y: 0 }), wire({ x: 1, y: 0 })]),
    ]),
  ).toHaveLength(1)
  expect(
    checkPcbTracesOutOfBoard([
      shiftedBoard,
      trace([wire({ x: 20, y: -10 }), wire({ x: 21, y: -10 })]),
    ]),
  ).toEqual([])
})

const notchedOutline = [
  { x: -5, y: -5 },
  { x: 5, y: -5 },
  { x: 5, y: 5 },
  { x: 2, y: 5 },
  { x: 2, y: -2 },
  { x: -2, y: -2 },
  { x: -2, y: 5 },
  { x: -5, y: 5 },
]

test.each(
  [notchedOutline, [...notchedOutline].reverse()].map((outline) => ({
    outline,
  })),
)(
  "rejects a trace wholly in a concave outline's notch regardless of winding",
  ({ outline }) => {
    const notchedBoard = { ...board, outline }
    expect(
      checkPcbTracesOutOfBoard([
        notchedBoard,
        trace([wire({ x: 0, y: 0 }), wire({ x: 0, y: 3 })]),
      ]),
    ).toHaveLength(1)
    expect(
      checkPcbTracesOutOfBoard([
        notchedBoard,
        trace([wire({ x: -3, y: 0 }), wire({ x: -3, y: 3 })]),
      ]),
    ).toEqual([])
    // Endpoints alone are insufficient: this segment leaves and re-enters the board.
    expect(
      checkPcbTracesOutOfBoard([
        notchedBoard,
        trace([wire({ x: -3, y: 0 }), wire({ x: 3, y: 0 })]),
      ]),
    ).toHaveLength(1)
  },
)

test("zero margin still rejects off-board copper while accepting legal edge contact", () => {
  expect(
    checkPcbTracesOutOfBoard(
      [board, trace([wire({ x: 8, y: 0 }), wire({ x: 9, y: 0 })])],
      { margin: 0 },
    ),
  ).toHaveLength(1)
  expect(
    checkPcbTracesOutOfBoard(
      [board, trace([wire({ x: -1, y: 4.9 }), wire({ x: 1, y: 4.9 })])],
      { margin: 0 },
    ),
  ).toEqual([])
})

test.each([1.4, 2.4])(
  "checks the wide end of a tapered trace (width %s)",
  (width) => {
    const tapered = trace(
      [wire({ x: -2, y: 4.2 }), wire({ x: 2, y: 4.2, width })],
      { route_thickness_mode: "interpolated" },
    )
    expect(checkPcbTracesOutOfBoard([board, tapered])).toHaveLength(1)
    expect(
      checkPcbTracesOutOfBoard([
        board,
        { ...tapered, route: [...tapered.route].reverse() },
      ]),
    ).toHaveLength(1)
  },
)

test("respects flat tapered end caps and checks the actual taper instead of its maximum width", () => {
  const tapered = trace(
    [wire({ x: 0, y: 0, width: 2 }), wire({ x: 4.8, y: 0, width: 0.2 })],
    { route_thickness_mode: "interpolated" },
  )
  expect(checkPcbTracesOutOfBoard([board, tapered])).toEqual([])
  expect(
    checkPcbTracesOutOfBoard([
      board,
      { ...tapered, route: [...tapered.route].reverse() },
    ]),
  ).toEqual([])
  expect(
    checkPcbTracesOutOfBoard([board, tapered], { margin: 0.21 }),
  ).toHaveLength(1)
})

test("checks the joined copper outline of a tapered bend", () => {
  const bent = trace(
    [
      wire({ x: -2, y: 4.5 }),
      wire({ x: 0, y: 4.5, width: 2 }),
      wire({ x: 0, y: 2 }),
    ],
    { route_thickness_mode: "interpolated" },
  )
  expect(checkPcbTracesOutOfBoard([board, bent])).toHaveLength(1)
  expect(
    checkPcbTracesOutOfBoard([
      board,
      {
        ...bent,
        route: bent.route.map((point) =>
          point.route_type === "wire" ? { ...point, y: point.y - 2 } : point,
        ),
      },
    ]),
  ).toEqual([])
})

test("reports the off-board trace through the routing runner", async () => {
  const errors = await runAllRoutingChecks([
    board,
    trace([wire({ x: 8, y: 0 }), wire({ x: 9, y: 0 })]),
  ])
  expect(
    errors.some(
      (error) =>
        error.type === "pcb_trace_error" &&
        error.pcb_trace_id === "trace" &&
        error.pcb_trace_error_id === "trace_too_close_to_board_trace_segment_0",
    ),
  ).toBe(true)
})
