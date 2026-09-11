import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { any_circuit_element, type AnyCircuitElement } from "circuit-json"
import { checkPcbComponentsMissingCourtyard } from "../../lib/check-pcb-components-missing-courtyard"
import {
  consolidateMissingCourtyardWarnings,
  type ConsolidatedMissingCourtyardWarning,
} from "../../lib/consolidate-missing-courtyard-warnings"
import { runAllPlacementChecks } from "../../lib/run-all-checks"
import { renderWarningConsolidation } from "../fixtures/render-warning-consolidation"

function fixture() {
  const db = cju([])
  for (const [i, name] of ["R1", "R2", "C1", "U1"].entries()) {
    const source = db.source_component.insert({ name, ftype: "simple_chip" })
    db.pcb_component.insert({
      source_component_id: source.source_component_id,
      center: { x: i * 10, y: 0 },
      width: 2,
      height: 2,
      layer: "top",
      rotation: 0,
      obstructs_within_bounds: false,
    })
  }
  return db.toArray()
}

test("groups missing courtyards and preserves all affected components", async () => {
  const circuit = fixture()
  const raw = checkPcbComponentsMissingCourtyard(circuit)
  const original = structuredClone(raw)
  const result = consolidateMissingCourtyardWarnings(
    circuit,
    raw,
  ) as ConsolidatedMissingCourtyardWarning[]
  expect(raw).toHaveLength(4)
  expect(result).toHaveLength(1)
  expect(result[0].related_warnings).toEqual(raw)
  expect(result[0].pcb_component_ids).toHaveLength(4)
  expect(result[0].source_component_ids).toHaveLength(4)
  expect(result[0].message).toContain("+1 more")
  expect(any_circuit_element.safeParse(result[0]).success).toBe(true)
  expect(consolidateMissingCourtyardWarnings(circuit, result)).toEqual(result)
  expect(raw).toEqual(original)
  const allRaw = await runAllPlacementChecks(circuit, {
    consolidateMissingCourtyards: false,
  })
  expect(allRaw.filter((e) => e.type === raw[0].type)).toEqual(raw)
  const all = await runAllPlacementChecks(circuit)
  expect(all.filter((e) => e.type === raw[0].type)).toEqual(result)
  expect(
    renderWarningConsolidation(
      "Missing courtyards: one summary per subcircuit",
      raw,
      result,
    ),
  ).toMatchSvgSnapshot(import.meta.path)
})

test("keeps unrelated errors, separate subcircuits, severity and singletons", () => {
  const circuit = fixture()
  const [a, b] = checkPcbComponentsMissingCourtyard(circuit)
  const other = { ...a, subcircuit_id: "other" }
  const fatal = { ...a, is_fatal: true }
  const error: AnyCircuitElement = {
    type: "pcb_placement_error",
    pcb_placement_error_id: "placement",
    error_type: "pcb_placement_error",
    message: "U1 is outside the board",
  }
  const result = consolidateMissingCourtyardWarnings(circuit, [
    a,
    error,
    b,
    other,
    fatal,
  ])
  expect(result).toHaveLength(4)
  expect(result.slice(1)).toEqual([error, other, fatal])
  expect(consolidateMissingCourtyardWarnings(circuit, [a])).toEqual([a])
  expect(consolidateMissingCourtyardWarnings(circuit, [])).toEqual([])
  const reversed = consolidateMissingCourtyardWarnings(circuit, [
    b,
    a,
  ]) as ConsolidatedMissingCourtyardWarning[]
  expect(reversed[0].pcb_component_missing_courtyard_warning_id).toBe(
    (result[0] as ConsolidatedMissingCourtyardWarning)
      .pcb_component_missing_courtyard_warning_id,
  )
})
