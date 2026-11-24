import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { lcdEscape, checkEscape } from "./via-annulus-smt-fixture"

test("LCD_DE via annulus lands on the edge of the connector pad", () => {
  const circuit = lcdEscape()
  const errors = checkEscape(circuit)
  expect(
    convertCircuitJsonToPcbSvg([...circuit, ...errors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
  expect(errors).toEqual([])
})
