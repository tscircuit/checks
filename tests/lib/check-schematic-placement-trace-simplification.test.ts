import { expect, test } from "bun:test"
import { schematic_component_styling_warning } from "circuit-json"
import {
  checkSchematicPlacement,
  runAllChecks,
  runAllSchematicChecks,
} from "../.."
import { createTraceSimplificationCircuit } from "../fixtures/schematic-routing-placement"
import { containsCircuitJsonId } from "lib/util/get-readable-names"

test("reports trace simplification with stable component references and clears the corrected route", async () => {
  const json = await createTraceSimplificationCircuit()
  const original = structuredClone(json)
  const warnings = checkSchematicPlacement(json).filter(
    (w) =>
      w.styling_issue_type === "trace_can_be_simplified_by_moving_component",
  )
  expect(warnings).toHaveLength(1)
  const warning = warnings[0]!
  expect(schematic_component_styling_warning.parse(warning)).toEqual(warning)
  expect(warning.message).toBe(
    "Move R1 to schX=0.8, schY=2 to reduce the connected trace from 3 turns to 1. Preserve pin connections and reroute attached traces.",
  )
  const resistor = json.find(
    (e) => e.type === "source_component" && e.name === "R1",
  )!
  if (resistor.type !== "source_component") throw new Error("Missing resistor")
  expect(warning.source_component_id).toBe(resistor.source_component_id)
  expect(warning.schematic_port_ids).toHaveLength(2)
  for (const run of [runAllChecks, runAllSchematicChecks]) {
    expect(
      (await run(structuredClone(json))).filter(
        (w) =>
          w.type === "schematic_component_styling_warning" &&
          w.styling_issue_type === warning.styling_issue_type,
      ),
    ).toEqual(warnings)
  }
  expect(checkSchematicPlacement([...json, ...warnings])).toEqual(
    checkSchematicPlacement(json),
  )
  expect(json).toEqual(original)
  expect(
    checkSchematicPlacement(await createTraceSimplificationCircuit(0.8)).filter(
      (w) => w.styling_issue_type === warning.styling_issue_type,
    ),
  ).toEqual([])
  for (const e of json) if (e.type === "source_component") e.name = ""
  const unnamed = checkSchematicPlacement(json).filter(
    (w) => w.styling_issue_type === warning.styling_issue_type,
  )
  expect(unnamed).toHaveLength(1)
  expect(unnamed[0]!.message).toContain("unnamed component")
  expect(containsCircuitJsonId(unnamed[0]!.message)).toBe(false)
})
