import { expect, test } from "bun:test"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { renderStackedViaContinuity } from "../fixtures/stacked-via-continuity"

test("stacked blind barrels are order-independent without joining unsupported spans", async () => {
  const circuit = await renderStackedViaContinuity()
  const original = structuredClone(circuit)
  const barrels = circuit.filter((element) => element.type === "pcb_via")
  const trace = circuit.find((element) => element.type === "pcb_trace")!
  expect(
    circuit.find((element) => element.type === "pcb_board")!
      .allow_blind_and_buried_vias,
  ).toBeTrue()
  expect(barrels).toHaveLength(2)
  expect(barrels.map((barrel) => barrel.layers)).toEqual([
    ["top", "inner1"],
    ["inner1", "inner2", "bottom"],
  ])
  expect(barrels[0]!.x).toBe(barrels[1]!.x)
  expect(barrels[0]!.y).toBe(barrels[1]!.y)
  expect(barrels.map((barrel) => barrel.pcb_trace_id)).toEqual([
    trace.pcb_trace_id,
    trace.pcb_trace_id,
  ])
  expect(
    circuit.filter((element) => element.type === "pcb_smtpad"),
  ).toHaveLength(4)
  expect(checkTracesAreContiguous(circuit)).toEqual([])
  const reversed = [
    ...circuit.filter((element) => element.type !== "pcb_via"),
    ...barrels.toReversed(),
  ]
  expect(checkTracesAreContiguous(reversed)).toEqual([])
  expect(circuit).toEqual(original)

  // Removing the INNER1 land breaks the physical junction. Other nearby barrels
  // cannot lend their layers to a different barrel or expand its actual span.
  const disconnected = structuredClone(circuit)
  const lowerBarrel = disconnected.find(
    (element) => element.type === "pcb_via" && element.from_layer === "inner1",
  )!
  if (lowerBarrel.type !== "pcb_via") throw new Error("Expected lower barrel")
  lowerBarrel.layers = ["inner2", "bottom"]
  lowerBarrel.from_layer = "inner2"
  const expectedError = `misaligned_via_${trace.pcb_trace_id}_4`
  expect(
    checkTracesAreContiguous(disconnected).map(
      (error) => error.pcb_trace_error_id,
    ),
  ).toContain(expectedError)
  const disconnectedReversed = [
    ...disconnected.filter((element) => element.type !== "pcb_via"),
    ...disconnected
      .filter((element) => element.type === "pcb_via")
      .toReversed(),
  ]
  expect(
    checkTracesAreContiguous(disconnectedReversed).map(
      (error) => error.pcb_trace_error_id,
    ),
  ).toContain(expectedError)
})
