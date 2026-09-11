import { expect, test } from "bun:test"
import { any_circuit_element, type AnyCircuitElement } from "circuit-json"
import {
  consolidateReferenceDesignatorWarnings,
  type ConsolidatedReferenceDesignatorWarning,
} from "../../lib/consolidate-reference-designator-warnings"
import { runAllSchematicChecks } from "../../lib/run-all-checks"
import fixture from "../fixtures/mspm0g3507-missing-refdes.json"
import { renderWarningConsolidation } from "../fixtures/render-warning-consolidation"

const circuit = fixture as AnyCircuitElement[]

test("MSPM0G3507: 28 warnings become one with every original location retained", async () => {
  const raw = await runAllSchematicChecks(circuit, {
    consolidateReferenceDesignators: false,
  })
  const original = structuredClone(raw)
  const result = (await runAllSchematicChecks(
    circuit,
  )) as ConsolidatedReferenceDesignatorWarning[]
  expect(raw).toHaveLength(28)
  expect(result).toHaveLength(1)
  expect(result[0].related_warnings).toEqual(raw)
  expect(result[0].schematic_component_ids).toHaveLength(28)
  expect(result[0].source_component_ids).toHaveLength(28)
  expect(result[0].message).toContain("+25 more")
  expect(any_circuit_element.safeParse(result[0]).success).toBe(true)
  expect(consolidateReferenceDesignatorWarnings(circuit, result)).toEqual(
    result,
  )
  expect(raw).toEqual(original)
  expect(
    renderWarningConsolidation(
      "MSPM0G3507: missing reference designators",
      raw,
      result,
    ),
  ).toMatchSvgSnapshot(import.meta.path)
})

test("separates sheets, subcircuits, severity, other styling rules and singletons", async () => {
  const [a, b] = await runAllSchematicChecks(circuit, {
    consolidateReferenceDesignators: false,
  })
  const otherSheet = { ...a, schematic_sheet_id: "other_sheet" }
  const otherSubcircuit = { ...a, subcircuit_id: "other_subcircuit" }
  const fatal = { ...a, is_fatal: true }
  const otherRule = { ...a, styling_issue_type: "ports_outside_body" as const }
  const raw = [a, otherSheet, b, otherSubcircuit, fatal, otherRule]
  const result = consolidateReferenceDesignatorWarnings(circuit, raw)
  expect(result).toHaveLength(5)
  expect(result.slice(1)).toEqual([
    otherSheet,
    otherSubcircuit,
    fatal,
    otherRule,
  ])
  expect(consolidateReferenceDesignatorWarnings(circuit, [a])).toEqual([a])
  expect(consolidateReferenceDesignatorWarnings(circuit, [])).toEqual([])
  const reversed = consolidateReferenceDesignatorWarnings(circuit, [
    b,
    a,
  ]) as ConsolidatedReferenceDesignatorWarning[]
  expect(reversed[0].schematic_component_styling_warning_id).toBe(
    result[0].schematic_component_styling_warning_id,
  )
})
