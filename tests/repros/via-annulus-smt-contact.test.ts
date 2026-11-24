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
  // Reproduces both false positives on main.
  expect(errors.map((error) => error.type)).toEqual([
    "pcb_port_not_connected_error",
    "pcb_trace_error",
  ])
})
