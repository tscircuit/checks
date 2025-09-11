import { test, expect } from "bun:test"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import trapezoidBoardJson from "tests/assets/component-inside-of-trapezoid-board-shape.json"

test("trapezoid board: component inside/outside", () => {
  const circuitJson = trapezoidBoardJson as AnyCircuitElement[]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)
  // R1 is inside no errors
  expect(errors.length).toBe(0)
  // Snapshot SVG for visual verification
  expect(convertCircuitJsonToPcbSvg(circuitJson)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
