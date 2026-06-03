import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { runAllRoutingChecks } from "lib/run-all-checks"
import circuitJsonFixture from "../../assets/breakout-repros/repro-breakout-sot23-regulator-reduced.json"

test("repro breakout sot23 regulator reduced routing checks snapshot", async () => {
  const circuitJson = (circuitJsonFixture as AnyCircuitElement[]).filter(
    (element) => !element.type.endsWith("_error"),
  )

  const errors = await runAllRoutingChecks(circuitJson)

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
