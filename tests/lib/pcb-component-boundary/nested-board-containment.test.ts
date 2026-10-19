import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import {
  firstBoard,
  secondBoard,
  componentOnSecondBoard,
  componentSource,
} from "../../fixtures/multi-board-component-containment"

test("nested subcircuits inherit the nearest board and explicit board references take precedence", () => {
  const groups: AnyCircuitElement[] = [
    {
      type: "source_group",
      source_group_id: "middle_group",
      is_subcircuit: true,
      subcircuit_id: "middle",
      parent_subcircuit_id: "sub_b",
    },
    {
      type: "source_group",
      source_group_id: "leaf_group",
      is_subcircuit: true,
      subcircuit_id: "leaf",
      parent_subcircuit_id: "middle",
    },
  ]
  const nestedComponent = {
    ...componentOnSecondBoard,
    subcircuit_id: "leaf",
    center: { x: 26, y: 0 },
  }
  const circuitJson: AnyCircuitElement[] = [
    { ...firstBoard, width: 100 },
    secondBoard,
    ...groups,
    nestedComponent,
    componentSource,
  ]
  expect(checkPcbComponentsOutOfBoard(circuitJson)).toMatchObject([
    { pcb_board_id: "board_b", pcb_component_id: "component_b" },
  ])
  expect(
    checkPcbComponentsOutOfBoard([
      ...circuitJson.filter((element) => element !== nestedComponent),
      {
        ...nestedComponent,
        positioned_relative_to_pcb_board_id: "board_a",
      },
    ]),
  ).toEqual([])
  expect(
    checkPcbComponentsOutOfBoard([
      ...circuitJson,
      {
        ...secondBoard,
        pcb_board_id: "nested_board",
        subcircuit_id: "middle",
        center: { x: 30, y: 0 },
        width: 4,
      },
    ]),
  ).toMatchObject([
    { pcb_board_id: "nested_board", pcb_component_id: "component_b" },
  ])
})
