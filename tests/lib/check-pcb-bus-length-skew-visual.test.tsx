import { expect, test } from "bun:test"
import { checkPcbBusLengthSkew } from "../../lib/check-pcb-bus-length-skew"
import {
  lengthComparisonSvg,
  measuredMembers,
  renderLengthMatchingBoard,
} from "../fixtures/length-matching-visual"

test("TSX bus skew is visibly rejected above the limit and accepted at equality", async () => {
  const cases = []
  for (const maxLengthSkew of [2, 10]) {
    const circuit = await renderLengthMatchingBoard({ maxLengthSkew })
    expect(measuredMembers(circuit)).toEqual([
      { name: "D0", length: 20 },
      { name: "D1", length: 30 },
    ])
    expect(circuit.find((e) => e.type === "source_bus")).toMatchObject({
      name: "DATA",
      max_length_skew: maxLengthSkew,
    })
    const errors = checkPcbBusLengthSkew(circuit)
    expect(errors).toHaveLength(maxLengthSkew === 2 ? 1 : 0)
    if (errors.length)
      expect(errors[0]).toMatchObject({
        type: "pcb_bus_length_skew_error",
        actual_length_skew: 10,
        maximum_length_skew: 2,
      })
    cases.push({
      title:
        maxLengthSkew === 2
          ? "Bus exceeds allowed skew"
          : "Bus exactly at allowed skew",
      jsx: [
        '<bus name="DATA" connections={["D0", "D1"]}',
        `  maxLengthSkew={${maxLengthSkew}} />`,
      ],
      circuit,
      errors,
      comparison: `30.00 − 20.00 = 10.00 mm skew  ${errors.length ? ">" : "="}  ${maxLengthSkew.toFixed(2)} mm limit`,
    })
  }
  expect(
    lengthComparisonSvg({
      title: "Bus length matching",
      subtitle:
        "Same copper, different requirement. The actual check result is shown below each PCB.",
      cases,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
