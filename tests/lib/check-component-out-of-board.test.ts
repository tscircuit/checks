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
      "error_type": "pcb_placement_error",
      "message": "Component resistor[R1] out of board",
      "pcb_placement_error_id": "out_of_board_pcb_component_0",
      "type": "pcb_placement_error",
    },
  ]
`,
  )
  expect(pcbPlacementError.length).toBe(1)
})
