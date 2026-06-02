import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { runAllRoutingChecks } from "lib/run-all-checks"
import circuitJsonFixture from "../../assets/breakout-repros/repro-breakout-sot23-regulator-overlap.json"

test("repro breakout sot23 regulator overlap routing checks snapshot", async () => {
  const circuitJson = circuitJsonFixture as AnyCircuitElement[]

  const errors = await runAllRoutingChecks(circuitJson)

  expect(errors).toHaveLength(14)
  expect(
    errors.filter((error) => error.message.includes("overlaps with")),
  ).toHaveLength(5)
  expect(
    errors.filter((error) => error.message.includes("too close")),
  ).toHaveLength(2)
  expect(
    errors.filter((error) => error.message.includes("disconnected endpoint")),
  ).toHaveLength(2)
  expect(
    errors.filter((error) => error.message.includes("missing a connection")),
  ).toHaveLength(5)
  expect(
    errors.filter((error) =>
      error.message.includes(
        "trace[.U1 > port.pin2] overlaps with trace[.JOUT > port.pin2]",
      ),
    ),
  ).toHaveLength(1)
  expect(
    errors.filter((error) =>
      error.message.includes(
        "trace[.U1 > port.pin2] overlaps with trace[.JIN > port.pin2]",
      ),
    ),
  ).toHaveLength(1)
  expect(
    errors.filter((error) =>
      error.message.includes(
        "trace[.JIN > port.pin2] overlaps with trace[.JOUT > port.pin2]",
      ),
    ),
  ).toHaveLength(1)

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
