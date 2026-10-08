import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkCopperPourShorts } from "../../lib/check-copper-pour-shorts"
import dp83825VddioH3 from "../assets/dp83825evm-vddio-h3.circuit.json"

test("DP83825 VDDIO pour clears the H3 mounting hole", async () => {
  const circuitJson = dp83825VddioH3 as AnyCircuitElement[]
  const errors = checkCopperPourShorts(circuitJson)

  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      width: 900,
      height: 700,
      viewport: { minX: 17, maxX: 29, minY: 38, maxY: 50 },
      backgroundColor: "white",
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
      includeVersion: false,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
