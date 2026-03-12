import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbCourtyardOverlap } from "lib/check-pcb-courtyard-overlap/checkPcbCourtyardOverlap"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"
import circuitJson from "./assets/horizontal-overlap.json"

// U1 courtyard center x = -0.1, half-width = 1.13  → x: -1.23 to +1.03
// U2 courtyard center x =  2.0, half-width = 1.13  → x: +0.87 to +3.13
// Courtyard overlap: x = 0.87 → 1.03 (≈ 0.16 mm)
// Pad gap: 1.59 − 0.27 − (0.51 + 0.27) = 0.54 mm → no pad overlap

test("courtyard overlap: horizontal (X-axis only)", () => {
  const circuit = circuitJson as AnyCircuitElement[]

  const padErrors = checkPcbComponentOverlap(circuit)
  expect(padErrors).toHaveLength(0)

  const errors = checkPcbCourtyardOverlap(circuit)
  expect(errors).toHaveLength(1)
  expect(errors[0].type).toBe("pcb_courtyard_overlap_error")
  expect(errors[0].message).toContain("U1")
  expect(errors[0].message).toContain("U2")

  circuit.push(...errors)

  expect(
    convertCircuitJsonToPcbSvg(circuit, {
      shouldDrawErrors: true,
      showCourtyards: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
