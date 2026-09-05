import { expect, test } from "bun:test"
import { pcb_board, pcb_trace } from "circuit-json"
import {
  runAllRoutingChecks,
  intermediateRoutingChecks,
  checkPcbTracesOutOfBoard,
} from "../index"

test("select routing checks and attribute diagnostics without mutating input", async () => {
  const circuitJson = [
    pcb_board.parse({
      type: "pcb_board",
      pcb_board_id: "pcb_board_1",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
      num_layers: 2,
      thickness: 1.6,
    }),
    pcb_trace.parse({
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_1",
      source_trace_id: "source_trace_1",
      route: [
        { route_type: "wire", x: 0, y: 0, layer: "top", width: 0.2 },
        { route_type: "wire", x: 6, y: 0, layer: "top", width: 0.2 },
      ],
    }),
  ]
  const before = structuredClone(circuitJson)
  const phase = {
    subcircuit_id: "subcircuit_1",
    routing_phase_index: 0,
    name: "fanout",
  }
  const expected = checkPcbTracesOutOfBoard(circuitJson)
  expect(expected.length).toBeGreaterThan(0)
  const errors = await runAllRoutingChecks(circuitJson, {
    checks: ["checkPcbTracesOutOfBoard", "checkPcbTracesOutOfBoard"],
    autoroutingPhase: phase,
  })
  expect(errors).toEqual(
    expected.map((error) => ({ ...error, autorouting_phase: phase })),
  )
  expect(await runAllRoutingChecks(circuitJson, { checks: [] })).toEqual([])
  expect(
    await runAllRoutingChecks(circuitJson, {
      checks: ["checkPcbTracesOutOfBoard"],
    }),
  ).toEqual(expected)
  expect(circuitJson).toEqual(before)
  expect(intermediateRoutingChecks).not.toContain(
    "checkSourceTracesHavePcbTraces",
  )
  expect(intermediateRoutingChecks).not.toContain(
    "checkEachPcbPortConnectedToPcbTraces",
  )
})
