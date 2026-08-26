import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViasInPads } from "lib/check-vias-in-pads"
import { runAllPlacementChecks } from "lib/run-all-checks"
import { containsCircuitJsonId } from "lib/util/get-readable-names"
import { makeBoard, rectPad, viaInRectPad } from "./check-vias-in-pads-fixtures"

test("reports a via whose center overlaps an SMD pad when its net is unresolved", async () => {
  const circuitJson: AnyCircuitElement[] = [makeBoard(), rectPad, viaInRectPad]

  const errors = checkViasInPads(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_placement_error",
    pcb_placement_error_id: "via_in_pad_pcb_via_1_pcb_smtpad_1",
    error_type: "pcb_placement_error",
  })
  expect(errors[0].message).toContain("overlaps SMD pad")
  expect(containsCircuitJsonId(errors[0].message)).toBe(false)
  expect(await runAllPlacementChecks(circuitJson)).toContainEqual(errors[0])
})
