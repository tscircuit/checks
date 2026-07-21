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
  const platedHole = circuitJson.find(
    (element) =>
      element.type === "pcb_plated_hole" &&
      element.pcb_plated_hole_id === "pcb_plated_hole_1",
  )
  expect(platedHole?.type).toBe("pcb_plated_hole")
  if (platedHole?.type !== "pcb_plated_hole") return

  for (const center of errorCenters) {
    expect(
      Math.hypot(center.x - platedHole.x, center.y - platedHole.y),
    ).toBeCloseTo(platedHole.outer_diameter / 2, 2)
  }

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
