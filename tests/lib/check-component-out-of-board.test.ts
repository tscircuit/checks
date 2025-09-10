import { test, expect } from "bun:test"
import componentOutOfBoard from "tests/assets/component-out-of-board.json"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
test("pcb component out of board", async () => {
  const pcbPlacementError = checkPcbComponentsOutOfBoard(
    componentOutOfBoard as any,
  )

  expect(pcbPlacementError).toMatchInlineSnapshot(
    `
  [
    {
      "component_bounds": {
        "max_x": 7.8,
        "max_y": 0.30000000000000004,
        "min_x": 6.2,
        "min_y": -0.30000000000000004,
      },
      "component_center": {
        "x": 7,
        "y": 0,
      },
      "error_type": "pcb_component_outside_board_error",
      "message": "Component R1 (pcb_component_0) extends outside board boundaries by 2.8mm",
      "pcb_board_id": "pcb_board_0",
      "pcb_component_id": "pcb_component_0",
      "pcb_component_outside_board_error_id": "pcb_component_outside_board_pcb_component_0",
      "source_component_id": "source_component_0",
      "subcircuit_id": "subcircuit_source_group_0",
      "type": "pcb_component_outside_board_error",
    },
  ]
`,
  )
  expect(pcbPlacementError.length).toBe(1)
})
