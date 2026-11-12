import { expect, test } from "bun:test"
import { schematic_component_styling_warning } from "circuit-json"
import {
  checkSchematicPlacement,
  runAllChecks,
  runAllSchematicChecks,
} from "../.."
import { containsCircuitJsonId } from "lib/util/get-readable-names"
import { createBranchOrder } from "../fixtures/schematic-branch-order"

test("reports crossed component branches on their host and clears the corrected layout", async () => {
  const json = await createBranchOrder()
  const original = structuredClone(json)
  const warnings = checkSchematicPlacement(json).filter(
    (w) => w.styling_issue_type === "component_branches_out_of_order",
  )
  expect(warnings).toHaveLength(1)
  const w = warnings[0]!
  expect(schematic_component_styling_warning.parse(w)).toEqual(w)
  expect(w.message).toContain("Reorder RS_M1 and RS_M2")
  expect(w.message).toContain("U_DRV12")
  expect(w.message).toContain("without moving the host pins")
  const host = json.find(
    (e) => e.type === "source_component" && e.name === "U_DRV12",
  )!
  if (host.type !== "source_component") throw new Error("Missing host")
  expect(w.source_component_id).toBe(host.source_component_id)
  for (const run of [runAllChecks, runAllSchematicChecks]) {
    expect(
      (await run(structuredClone(json))).filter(
        (e) =>
          e.type === "schematic_component_styling_warning" &&
          e.styling_issue_type === w.styling_issue_type,
      ),
    ).toEqual(warnings)
  }
  expect(checkSchematicPlacement([...json, ...warnings])).toEqual(
    checkSchematicPlacement(json),
  )
  expect(json).toEqual(original)
  expect(
    checkSchematicPlacement(await createBranchOrder(true)).filter(
      (e) => e.styling_issue_type === w.styling_issue_type,
    ),
  ).toEqual([])
  for (const e of json) if (e.type === "source_component") e.name = ""
  const unnamed = checkSchematicPlacement(json).filter(
    (e) => e.styling_issue_type === w.styling_issue_type,
  )
  expect(unnamed).toHaveLength(1)
  expect(unnamed[0]!.message).toContain("unnamed component")
  expect(containsCircuitJsonId(unnamed[0]!.message)).toBe(false)
})
