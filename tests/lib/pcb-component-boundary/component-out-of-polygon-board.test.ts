import { test, expect } from "bun:test"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import rectBoardJson from "tests/assets/component-out-of-board.json"
import polygonBoardJson from "tests/assets/component-out-of-polygon-board.json"

test("rectangular board: component inside/outside", () => {
  const errors = checkPcbComponentsOutOfBoard(
    rectBoardJson as AnyCircuitElement[],
  )
  // R1 is outside
  expect(errors.length).toBe(1)
  expect(errors[0].pcb_component_id).toBe("pcb_component_0")
  expect(errors[0].message).toMatch(/extends outside board boundaries/)

  // Snapshot SVG for visual verification
  expect(
    convertCircuitJsonToPcbSvg(rectBoardJson as AnyCircuitElement[]),
  ).toMatchSvgSnapshot(import.meta.path + "-rect-board")
})

test("polygon board: component inside/outside", () => {
  const errors = checkPcbComponentsOutOfBoard(
    polygonBoardJson as AnyCircuitElement[],
  )
  // pcb_component_1 is outside polygon
  expect(errors.length).toBe(1)
  expect(errors[0].pcb_component_id).toBe("pcb_component_1")
  expect(errors[0].message).toMatch(/extends outside board boundaries/)

  // Snapshot SVG for visual verification
  expect(
    convertCircuitJsonToPcbSvg(polygonBoardJson as AnyCircuitElement[]),
  ).toMatchSvgSnapshot(import.meta.path + "-polygon-board")
})
