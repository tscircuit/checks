import { test, expect } from "bun:test"
import componentOutOfBoard from "tests/assets/component-out-of-board.json"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-outside-board/areComponentsOutOfBoard"
test("pcb component out of board", async () => {
  const pcbPlacementError = checkPcbComponentsOutOfBoard(
    componentOutOfBoard as any,
  )

  expect(pcbPlacementError).toMatchInlineSnapshot(
    `
  [
    {
      "message": "Component source_component_1 out of board",
      "pcb_placement_error_id": "out_of_board_pcb_component_1",
      "type": "pcb_placement_error",
    },
  ]
`,
  )
  expect(pcbPlacementError.length).toBe(1)
})
