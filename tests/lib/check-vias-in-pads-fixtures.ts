import type {
  AnyCircuitElement,
  PcbBoard,
  PcbPlatedHole,
  PcbSmtPad,
  PcbVia,
} from "circuit-json"

export const makeBoard = (
  isViaInPadAllowed?: boolean,
): PcbBoard & { is_via_in_pad_allowed?: boolean } => ({
  type: "pcb_board",
  pcb_board_id: "pcb_board_1",
  center: { x: 0, y: 0 },
  width: 30,
  height: 20,
  thickness: 1.6,
  num_layers: 4,
  material: "fr4",
  ...(isViaInPadAllowed === undefined
    ? {}
    : { is_via_in_pad_allowed: isViaInPadAllowed }),
})

export const rectPad: PcbSmtPad = {
  type: "pcb_smtpad",
  pcb_smtpad_id: "pcb_smtpad_1",
  shape: "rect",
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  layer: "top",
}

export const viaInRectPad: PcbVia = {
  type: "pcb_via",
  pcb_via_id: "pcb_via_1",
  x: 0.2,
  y: 0.1,
  hole_diameter: 0.2,
  outer_diameter: 0.4,
  layers: ["top", "bottom"],
}

export const issueCornerPad: PcbSmtPad = {
  ...rectPad,
  x: 0,
  y: -0.825,
  width: 0.95,
  height: 0.8,
}

export const issueCornerVia: PcbVia = {
  ...viaInRectPad,
  x: 0.5,
  y: -1.4,
  hole_diameter: 0.3,
  outer_diameter: 0.6,
}

export const makeKnownNetCircuit = ({
  pad = rectPad,
  via = viaInRectPad,
  padNetId,
  viaNetId,
}: {
  pad?: PcbSmtPad | PcbPlatedHole
  via?: PcbVia
  padNetId: string
  viaNetId: string
}): AnyCircuitElement[] => [
  makeBoard(),
  ...[...new Set([padNetId, viaNetId])].map(
    (netId) =>
      ({
        type: "source_net",
        source_net_id: netId,
        name: netId,
        member_source_group_ids: [],
      }) as AnyCircuitElement,
  ),
  {
    type: "source_port",
    source_port_id: "source_port_pad",
    name: "PAD",
  },
  {
    type: "source_trace",
    source_trace_id: "source_trace_pad",
    connected_source_port_ids: ["source_port_pad"],
    connected_source_net_ids: [padNetId],
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_pad",
    source_port_id: "source_port_pad",
    x: 0,
    y: 0,
    layers: ["top"],
  },
  { ...pad, pcb_port_id: "pcb_port_pad" } as AnyCircuitElement,
  { ...via, source_net_id: viaNetId } as AnyCircuitElement,
]

export const supportedPadCases: Array<{
  shape: string
  pad: PcbSmtPad | PcbPlatedHole
  via: PcbVia
}> = [
  {
    shape: "circle",
    pad: {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_circle",
      shape: "circle",
      x: -6,
      y: 0,
      radius: 0.5,
      layer: "top",
    },
    via: { ...viaInRectPad, x: -6.4, y: 0 },
  },
  {
    shape: "polygon",
    pad: {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_polygon",
      shape: "polygon",
      points: [
        { x: -3.5, y: -0.5 },
        { x: -2.5, y: -0.5 },
        { x: -3, y: 0.5 },
      ],
      layer: "top",
    },
    via: { ...viaInRectPad, x: -3, y: 0 },
  },
  {
    shape: "rotated rectangle",
    pad: {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_rotated_rect",
      shape: "rotated_rect",
      x: 0,
      y: 0,
      width: 1,
      height: 0.5,
      ccw_rotation: 45,
      layer: "top",
    },
    via: { ...viaInRectPad, x: 0.35, y: 0.35 },
  },
  {
    shape: "pill",
    pad: {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_pill",
      shape: "pill",
      x: 3,
      y: 0,
      width: 1.4,
      height: 0.6,
      radius: 0.3,
      layer: "top",
    },
    via: { ...viaInRectPad, x: 3.5, y: 0 },
  },
  {
    shape: "rotated pill",
    pad: {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_rotated_pill",
      shape: "rotated_pill",
      x: 6,
      y: 0,
      width: 1.4,
      height: 0.6,
      radius: 0.3,
      ccw_rotation: 45,
      layer: "top",
    },
    via: { ...viaInRectPad, x: 6.35, y: 0.35 },
  },
  {
    shape: "circular plated hole",
    pad: {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "pcb_plated_hole_circle",
      shape: "circle",
      x: 9,
      y: 0,
      outer_diameter: 1,
      hole_diameter: 0.5,
      layers: ["top", "bottom"],
    },
    via: { ...viaInRectPad, x: 9.4, y: 0 },
  },
]
