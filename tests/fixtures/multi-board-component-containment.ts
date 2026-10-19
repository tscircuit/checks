import type { AnyCircuitElement, PcbBoard, PcbComponent } from "circuit-json"

export const firstBoard: PcbBoard = {
  type: "pcb_board",
  pcb_board_id: "board_a",
  subcircuit_id: "sub_a",
  center: { x: 0, y: 0 },
  width: 10,
  height: 10,
  thickness: 1.6,
  num_layers: 2,
  material: "fr4",
}

export const secondBoard: PcbBoard = {
  ...firstBoard,
  pcb_board_id: "board_b",
  subcircuit_id: "sub_b",
  center: { x: 20, y: 0 },
}

export const componentOnSecondBoard: PcbComponent = {
  type: "pcb_component",
  pcb_component_id: "component_b",
  source_component_id: "source_b",
  subcircuit_id: "sub_b",
  center: { x: 20, y: 0 },
  width: 2,
  height: 2,
  rotation: 0,
  layer: "top",
  obstructs_within_bounds: false,
}

export const componentSource: AnyCircuitElement = {
  type: "source_component",
  ftype: "simple_chip",
  source_component_id: "source_b",
  name: "U2",
}
