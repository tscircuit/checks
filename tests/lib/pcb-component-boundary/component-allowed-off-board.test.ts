import { test, expect } from "bun:test"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import type { AnyCircuitElement, PcbComponent } from "circuit-json"
import rectBoardJson from "tests/assets/component-out-of-board.json"

test("rectangular board: component allowed off-board", () => {
  const circuitJson = JSON.parse(
    JSON.stringify(rectBoardJson),
  ) as AnyCircuitElement[]

  // Verify initial state: R1 is outside and causes error
  let errors = checkPcbComponentsOutOfBoard(circuitJson)
  expect(errors.length).toBe(1)
  expect(errors[0].pcb_component_id).toBe("pcb_component_0")

  // Enable is_allowed_to_be_off_board for R1
  const r1 = circuitJson.find(
    (el) =>
      el.type === "pcb_component" && el.pcb_component_id === "pcb_component_0",
  ) as PcbComponent
  r1.is_allowed_to_be_off_board = true

  // Verify no error
  errors = checkPcbComponentsOutOfBoard(circuitJson)
  expect(errors.length).toBe(0)
})
