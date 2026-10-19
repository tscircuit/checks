import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { runAllRoutingChecks } from "lib/run-all-checks"
import { undefinedPlatedHoleOffsetsFixture } from "../fixtures/undefined-plated-hole-offsets"

test("routing DRC with undefined plated-hole offsets", async () => {
  const circuitJson = await undefinedPlatedHoleOffsetsFixture()
  expect(
    circuitJson.filter((element) => element.type === "pcb_trace"),
  ).toHaveLength(1)
  const diagnostics: AnyCircuitElement[] = []
  try {
    diagnostics.push(...(await runAllRoutingChecks(circuitJson)))
  } catch (error) {
    // Surface the actual exception with core's routing DRC diagnostic format.
    // This lets the snapshot display the crash instead of aborting before render.
    diagnostics.push({
      type: "source_runtime_error",
      source_runtime_error_id: "routing_drc_error",
      error_type: "source_runtime_error",
      phase_name: "PcbDesignRuleChecks",
      message: `DRC could not complete (routing): ${
        error instanceof Error ? error.message : String(error)
      }`,
    })
  }
  expect(diagnostics).toEqual([
    expect.objectContaining({
      type: "source_runtime_error",
      message: "DRC could not complete (routing): Illegal Parameters",
    }),
  ])
  const svg = convertCircuitJsonToPcbSvg([...circuitJson, ...diagnostics], {
    shouldDrawErrors: true,
    showErrorsInTextOverlay: true,
  })
  expect(svg).toContain("DRC could not complete (routing): Illegal Parameters")
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
