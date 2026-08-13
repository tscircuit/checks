import type { AnyCircuitElement, PcbBoard } from "circuit-json"

const board = (overrides: Partial<PcbBoard> = {}): PcbBoard => ({
  type: "pcb_board",
  pcb_board_id: "board",
  center: { x: 0, y: 0 },
  width: 10,
  height: 10,
  num_layers: 2,
  thickness: 1.6,
  material: "fr4",
  min_board_edge_clearance: 0.2,
  ...overrides,
})

const chamferedOutline = [
  { x: -5, y: -5 },
  { x: 3, y: -5 },
  { x: 5, y: -3 },
  { x: 5, y: 3 },
  { x: 3, y: 5 },
  { x: -5, y: 5 },
]

export const viaOutsideChamferedCorner: AnyCircuitElement[] = [
  board({ outline: chamferedOutline }),
  {
    type: "pcb_via",
    pcb_via_id: "via_outside_chamfer",
    x: 4.3,
    y: -4.3,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
  },
]

export const rotatedPlatedPillCrossingAngledEdge: AnyCircuitElement[] = [
  board({ outline: chamferedOutline }),
  {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "plated_pill_crossing_angle",
    shape: "pill",
    x: 3.2,
    y: 3.2,
    outer_width: 3,
    outer_height: 1,
    hole_width: 2,
    hole_height: 0.5,
    ccw_rotation: 45,
    layers: ["top", "bottom"],
  },
]

export const copperInsideButBelowClearance: AnyCircuitElement[] = [
  board({ min_board_edge_clearance: 0.5 }),
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad_below_clearance",
    shape: "circle",
    x: 4.2,
    y: 0,
    radius: 0.5,
    layer: "top",
  },
]

export const copperOutsideBoard: AnyCircuitElement[] = [
  board(),
  {
    type: "pcb_via",
    pcb_via_id: "via_outside_board",
    x: -5.1,
    y: -2.5,
    outer_diameter: 0.8,
    hole_diameter: 0.4,
    layers: ["top", "bottom"],
  },
  {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "plated_hole_outside_board",
    shape: "pill",
    x: 0,
    y: 5.1,
    outer_width: 2,
    outer_height: 1,
    hole_width: 1.2,
    hole_height: 0.5,
    ccw_rotation: 30,
    layers: ["top", "bottom"],
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "smtpad_outside_board",
    shape: "rect",
    x: 5.1,
    y: 2.5,
    width: 1,
    height: 1.5,
    layer: "top",
  },
]

export const roundedRectNearChamfer: AnyCircuitElement[] = [
  board({ outline: chamferedOutline }),
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "rounded_rect_near_chamfer",
    shape: "rect",
    x: 3.1,
    y: 3.1,
    width: 2,
    height: 2,
    rect_border_radius: 1,
    layer: "top",
  },
]

export const sharpRectNearChamfer: AnyCircuitElement[] = [
  board({ outline: chamferedOutline }),
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "sharp_rect_near_chamfer",
    shape: "rect",
    x: 3.1,
    y: 3.1,
    width: 2,
    height: 2,
    layer: "top",
  },
]

export const equivalentPassingGeometry: AnyCircuitElement[] = [
  board({
    outline: chamferedOutline,
    min_board_edge_clearance: 0.5,
  }),
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad_at_clearance",
    shape: "circle",
    x: 4,
    y: 0,
    radius: 0.5,
    layer: "top",
  },
  {
    type: "pcb_via",
    pcb_via_id: "via_inside_chamfer",
    x: 2.5,
    y: -4,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
  },
  {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "plated_pill_inside",
    shape: "pill",
    x: 0,
    y: 0,
    outer_width: 3,
    outer_height: 1,
    hole_width: 2,
    hole_height: 0.5,
    ccw_rotation: 45,
    layers: ["top", "bottom"],
  },
]
