import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaToPadSpacing } from "lib/check-via-to-pad-spacing"
import circuitJson from "tests/assets/via-too-close-to-pad.json"

test("renders PCB snapshot with via-to-pad spacing violations", async () => {
  const soup = circuitJson as AnyCircuitElement[]
  const errors = checkViaToPadSpacing(soup)

  expect(errors.length).toBeGreaterThan(0)
  expect(errors[0].message).toContain("too close to pad")

  const svg = convertCircuitJsonToPcbSvg([...soup, ...errors], {
    shouldDrawErrors: true,
  })

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
