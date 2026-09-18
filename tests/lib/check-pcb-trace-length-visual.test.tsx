import { expect, test } from "bun:test"
import { checkPcbTraceLengths } from "../../lib/check-pcb-trace-lengths"
import {
  lengthComparisonSvg,
  measuredMembers,
  renderLengthMatchingBoard,
} from "../fixtures/length-matching-visual"

test("TSX maxLength measures the routed detour and shows the actual overlength error", async () => {
  const cases = []
  for (const maxLength of [24, 30]) {
    const circuit = await renderLengthMatchingBoard({ maxLength })
    expect(measuredMembers(circuit)).toEqual([
      { name: "D0", length: 20 },
      { name: "D1", length: 30 },
    ])
    expect(
      circuit.find((e) => e.type === "source_trace" && e.name === "D1"),
    ).toMatchObject({ max_length: maxLength })
    const errors = checkPcbTraceLengths(circuit)
    expect(errors).toHaveLength(maxLength === 24 ? 1 : 0)
    if (errors.length)
      expect(errors[0]).toMatchObject({
        type: "pcb_trace_too_long_error",
        actual_trace_length: 30,
        maximum_trace_length: 24,
      })
    cases.push({
      title:
        maxLength === 24
          ? "Detour exceeds maximum"
          : "Detour exactly at maximum",
      jsx: [
        '<trace name="D1" from=".TX1 > .pin1"',
        `  to=".RX1 > .pin1" maxLength={${maxLength}} />`,
      ],
      circuit,
      errors,
      comparison: `30.00 mm routed length  ${errors.length ? ">" : "="}  ${maxLength.toFixed(2)} mm maximum`,
    })
  }
  expect(
    lengthComparisonSvg({
      title: "Trace maximum length",
      subtitle:
        "D1 endpoints are 20 mm apart, but its copper route is 30 mm. The routed length determines the result.",
      cases,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
