import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import {
  firstBoard,
  secondBoard,
  componentOnSecondBoard,
} from "../../fixtures/multi-board-component-containment"

test("legacy single-board inputs work while unresolved multi-board ownership is not guessed", () => {
  const unowned = { ...componentOnSecondBoard, subcircuit_id: undefined }
  expect(checkPcbComponentsOutOfBoard([firstBoard, unowned])).toHaveLength(1)
  expect(
    checkPcbComponentsOutOfBoard([firstBoard, secondBoard, unowned]),
  ).toEqual([])
  expect(
    checkPcbComponentsOutOfBoard([secondBoard, firstBoard, unowned]),
  ).toEqual([])
  expect(checkPcbComponentsOutOfBoard([unowned])).toEqual([])
  expect(
    checkPcbComponentsOutOfBoard([
      firstBoard,
      { ...unowned, positioned_relative_to_pcb_board_id: "missing_board" },
    ]),
  ).toEqual([])
  expect(
    checkPcbComponentsOutOfBoard([
      firstBoard,
      secondBoard,
      {
        ...componentOnSecondBoard,
        center: { x: 26, y: 0 },
        is_allowed_to_be_off_board: true,
      },
    ]),
  ).toEqual([])
  const cyclic: AnyCircuitElement[] = [
    firstBoard,
    secondBoard,
    { ...unowned, subcircuit_id: "cycle" },
    {
      type: "source_group",
      source_group_id: "cyclic_group",
      is_subcircuit: true,
      subcircuit_id: "cycle",
      parent_subcircuit_id: "cycle",
    },
  ]
  expect(checkPcbComponentsOutOfBoard(cyclic)).toEqual([])
  expect(
    checkPcbComponentsOutOfBoard([
      { ...firstBoard, width: undefined, height: undefined },
      secondBoard,
      { ...componentOnSecondBoard, center: { x: 26, y: 0 } },
    ]),
  ).toMatchObject([{ pcb_board_id: "board_b" }])
})
