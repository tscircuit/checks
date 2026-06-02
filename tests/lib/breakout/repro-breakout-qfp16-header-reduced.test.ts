import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { runAllRoutingChecks } from "lib/run-all-checks"
import circuitJsonFixture from "../../assets/breakout-repros/repro-breakout-qfp16-header-reduced.json"

test("repro breakout qfp16 header reduced routing checks snapshot", async () => {
  const circuitJson = circuitJsonFixture as AnyCircuitElement[]

  const errors = await runAllRoutingChecks(circuitJson)

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
