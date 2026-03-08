import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkViaToPadSpacing } from "lib/check-via-to-pad-spacing"
import type { AnyCircuitElement } from "circuit-json"
import circuitJson from "tests/assets/via-too-close-to-pad.json"

test("check-via-to-pad-spacing detects violations in realistic circuit", async () => {
  const elements = circuitJson as AnyCircuitElement[]
  const errors = checkViaToPadSpacing(elements)

  expect(errors.length).toBeGreaterThan(0)
  expect(errors[0].type).toBe("pcb_via_clearance_error")
  expect(errors[0].message).toContain("too close to pad")

  const svg = convertCircuitJsonToPcbSvg([...elements, ...errors], {
    shouldDrawErrors: true,
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
