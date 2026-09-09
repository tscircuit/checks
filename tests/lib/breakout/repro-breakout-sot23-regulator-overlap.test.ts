import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { runAllRoutingChecks } from "lib/run-all-checks"
import circuitJsonFixture from "../../assets/breakout-repros/repro-breakout-sot23-regulator-overlap.json"

test("repro breakout sot23 regulator overlap routing checks snapshot", async () => {
  const circuitJson = (circuitJsonFixture as AnyCircuitElement[]).filter(
    (element) => !element.type.endsWith("_error"),
  )

  const errors = await runAllRoutingChecks(circuitJson)

  expect(errors).toHaveLength(2)
  expect(
    errors.filter((error) => error.message.includes("overlaps with")),
  ).toHaveLength(0)
  expect(
    errors.filter((error) => error.message.includes("too close")),
  ).toHaveLength(2)
  expect(
    errors.filter((error) => error.message.includes("disconnected endpoint")),
  ).toHaveLength(0)
  expect(
    errors.filter((error) => error.message.includes("missing a connection")),
  ).toHaveLength(0)
  const errorCenters = errors
    .filter((error) => error.type === "pcb_pad_trace_clearance_error")
    .map((error) => error.center)
    .filter(
      (center): center is { x: number; y: number } =>
        typeof center?.x === "number" && typeof center.y === "number",
    )
  expect(errorCenters).toHaveLength(2)
  // Both traces nearly touch the same edge of the circular plated hole.
  // Preserve those physical locations instead of separating markers by 1mm.
  for (const error of errors) {
    if (error.type !== "pcb_pad_trace_clearance_error") continue
    const center = error.center!
    expect(Math.hypot(center.x! + 4.73, center.y! + 1) - 0.75).toBeCloseTo(
      error.actual_clearance! / 2,
      10,
    )
  }

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
