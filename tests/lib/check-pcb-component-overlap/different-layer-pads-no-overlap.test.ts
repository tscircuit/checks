import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"
import circuitJson from "tests/assets/different-layer-pads-no-overlap.circuit.json"

test("SMT pads on different layers at the same position should NOT be flagged as overlapping", () => {
  const errors = checkPcbComponentOverlap(circuitJson as AnyCircuitElement[])
  expect(errors).toHaveLength(0)

  const circuitJsonWithErrors = [
    ...(circuitJson as AnyCircuitElement[]),
    ...errors,
  ]
  expect(
    convertCircuitJsonToPcbSvg(circuitJsonWithErrors, {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
