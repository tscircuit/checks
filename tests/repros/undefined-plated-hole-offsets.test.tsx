import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { runAllRoutingChecks } from "lib/run-all-checks"
import { undefinedPlatedHoleOffsetsFixture } from "../fixtures/undefined-plated-hole-offsets"

test("routing DRC with undefined plated-hole offsets", async () => {
  const circuitJson = await undefinedPlatedHoleOffsetsFixture()
  expect(
    circuitJson.filter((element) => element.type === "pcb_trace"),
  ).toHaveLength(1)
  const diagnostics = await runAllRoutingChecks(circuitJson)
  expect(diagnostics).toEqual([])
  const svg = convertCircuitJsonToPcbSvg([...circuitJson, ...diagnostics], {
    shouldDrawErrors: true,
    showErrorsInTextOverlay: true,
  })
  expect(svg).not.toContain("pcb_error_text_overlay")
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
