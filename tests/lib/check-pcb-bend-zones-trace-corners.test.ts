import { expect, test } from "bun:test"
import { board, bend, trace } from "../fixtures/pcb-bend-zones"
import { checkPcbBendZoneTraces } from "../../index"

test("allows straight perpendicular crossings and reports corners once, including reversals", () => {
  const traces = [
    trace("perpendicular", [
      [-5, 0],
      [0, 0],
      [0, 0],
      [5, 0],
    ]),
    trace("reversal", [
      [-5, 1],
      [0, 1],
      [0, 1],
      [-5, 1],
    ]),
    trace("many_corners", [
      [-5, 2],
      [0, 2],
      [0, 3],
      [0.5, 3],
      [0.5, 4],
    ]),
    trace("corner_outside", [
      [-5, 5],
      [-2, 5],
      [-2, 8],
    ]),
  ]
  const errors = checkPcbBendZoneTraces([board, bend, ...traces])
  expect(errors.map((error) => error.pcb_trace_id)).toEqual([
    "reversal",
    "many_corners",
  ])
  expect(errors[0]?.message).toContain("Trace corner")
  expect(errors[0]?.center).toMatchObject({ x: 0, y: 1 })
  expect(errors[0]?.source_trace_id).toBe("")
})
