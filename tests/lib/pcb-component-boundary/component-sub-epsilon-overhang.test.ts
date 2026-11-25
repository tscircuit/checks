import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { pcb_board, pcb_component, pcb_smtpad } from "circuit-json"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"

const board = pcb_board.parse({
  type: "pcb_board",
  pcb_board_id: "pcb_board_0",
  center: { x: 0, y: 0 },
  width: 10,
  height: 10,
  num_layers: 2,
})

const component = pcb_component.parse({
  type: "pcb_component",
  pcb_component_id: "pcb_component_0",
  source_component_id: "source_component_0",
  center: { x: 4.5, y: 0 },
  width: 1,
  height: 2,
  rotation: 0,
  layer: "top",
})

const pad: AnyCircuitElement = pcb_smtpad.parse({
  type: "pcb_smtpad",
  pcb_smtpad_id: "pcb_smtpad_0",
  pcb_component_id: "pcb_component_0",
  shape: "rect",
  x: 4.5,
  y: 0,
  width: 1.002,
  height: 2,
  layer: "top",
})

test("a component overhanging the board edge by less than the DRC epsilon is not reported", () => {
  const diagnostics = checkPcbComponentsOutOfBoard([board, component, pad])
  expect(diagnostics).toEqual([])
})
