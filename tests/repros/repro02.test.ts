import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { runAllPlacementChecks } from "../../lib/run-all-checks"
import repro02 from "./repro02.json"

test("repro02 should report the J_SWD pin1 hole overlap", async () => {
  const circuitJson = repro02 as AnyCircuitElement[]
  const placementIssues = await runAllPlacementChecks(circuitJson)
  const serializedPlacementIssues = JSON.stringify(placementIssues)

  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...placementIssues], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)

  expect(serializedPlacementIssues).toContain("pcb_plated_hole_4")
  expect(serializedPlacementIssues).toContain("pcb_hole_0")
})
