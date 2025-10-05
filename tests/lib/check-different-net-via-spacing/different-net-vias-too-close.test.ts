import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkDifferentNetViaSpacing } from "lib/check-different-net-via-spacing"
import circuitJson from "tests/assets/different-net-vias-too-close.json"

test("renders snapshot highlighting different-net vias that are too close", async () => {
  const soup = circuitJson as AnyCircuitElement[]
  const errors = checkDifferentNetViaSpacing(soup)

  expect(errors.length).toBeGreaterThan(0)
  expect(errors[0].message).toContain("Different-net vias")
  expect(errors[0].message).toContain("must have at least")

  const svg = convertCircuitJsonToPcbSvg([...soup, ...errors], {
    shouldDrawErrors: true,
  })

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
