import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbPlatedHole,
  PcbSmtPad,
  PcbVia,
} from "circuit-json"
import { checkViasInPads } from "lib/check-vias-in-pads"
import { runAllPlacementChecks } from "lib/run-all-checks"
import { containsCircuitJsonId } from "lib/util/get-readable-names"

const makeBoard = (
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

const rectPad: PcbSmtPad = {
  type: "pcb_smtpad",
  pcb_smtpad_id: "pcb_smtpad_1",
  shape: "rect",
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  layer: "top",
}

const viaInRectPad: PcbVia = {
  type: "pcb_via",
  pcb_via_id: "pcb_via_1",
  x: 0.2,
  y: 0.1,
  hole_diameter: 0.2,
  outer_diameter: 0.4,
  layers: ["top", "bottom"],
}

const issueCornerPad: PcbSmtPad = {
  ...rectPad,
  x: 0,
  y: -0.825,
  width: 0.95,
  height: 0.8,
}

const issueCornerVia: PcbVia = {
  ...viaInRectPad,
  x: 0.5,
  y: -1.4,
  hole_diameter: 0.3,
  outer_diameter: 0.6,
}

const makeKnownNetCircuit = ({
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

test("reports a via whose center overlaps an SMD pad when its net is unresolved", async () => {
  const circuitJson: AnyCircuitElement[] = [makeBoard(), rectPad, viaInRectPad]

  const errors = checkViasInPads(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_placement_error",
    pcb_placement_error_id: "via_in_pad_pcb_via_1_pcb_smtpad_1",
    error_type: "pcb_placement_error",
  })
  expect(errors[0].message).toContain("overlaps SMD pad")
  expect(containsCircuitJsonId(errors[0].message)).toBe(false)
  expect(await runAllPlacementChecks(circuitJson)).toContainEqual(errors[0])
})

test.each([
  {
    overlap: "center overlap",
    pad: rectPad,
    via: viaInRectPad,
  },
  {
    overlap: "corner-only overlap",
    pad: issueCornerPad,
    via: issueCornerVia,
  },
  {
    overlap: "plated-hole center overlap",
    pad: {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "pcb_plated_hole_same_net",
      shape: "circle",
      x: 0,
      y: 0,
      outer_diameter: 1,
      hole_diameter: 0.5,
      layers: ["top", "bottom"],
    } as PcbPlatedHole,
    via: viaInRectPad,
  },
])("allows a same-net $overlap", ({ pad, via }) => {
  const circuitJson = makeKnownNetCircuit({
    pad,
    via,
    padNetId: "source_net_gnd",
    viaNetId: "source_net_gnd",
  })

  expect(checkViasInPads(circuitJson)).toEqual([])
})

test.each([
  {
    overlap: "center overlap",
    pad: rectPad,
    via: viaInRectPad,
  },
  {
    overlap: "issue #241 corner-only overlap",
    pad: issueCornerPad,
    via: issueCornerVia,
  },
])("reports a different-net $overlap", ({ pad, via }) => {
  const circuitJson = makeKnownNetCircuit({
    pad,
    via,
    padNetId: "source_net_sig",
    viaNetId: "source_net_gnd",
  })

  expect(checkViasInPads(circuitJson)).toHaveLength(1)
})

test("reports an unresolved-net corner overlap", () => {
  expect(
    checkViasInPads([makeBoard(), issueCornerPad, issueCornerVia]),
  ).toHaveLength(1)
})

const supportedPadCases: Array<{
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

test.each(supportedPadCases)(
  "detects copper overlap with a $shape pad",
  ({ pad, via }) => {
    expect(checkViasInPads([makeBoard(), pad, via])).toHaveLength(1)
  },
)

test("treats zero-gap tangency as copper contact", () => {
  const tangentVia: PcbVia = {
    ...viaInRectPad,
    x: 0.7,
    y: 0,
  }

  expect(checkViasInPads([makeBoard(), rectPad, tangentVia])).toHaveLength(1)
})

test("ignores a corner near-miss whose copper bounds touch the pad bounds", () => {
  const cornerNearMissVia: PcbVia = {
    ...viaInRectPad,
    x: 0.7,
    y: 0.7,
  }

  expect(checkViasInPads([makeBoard(), rectPad, cornerNearMissVia])).toEqual([])
})

test("ignores an overlap on non-overlapping layers", () => {
  const innerLayerVia: PcbVia = {
    ...viaInRectPad,
    layers: ["inner1", "inner2"],
  }

  expect(checkViasInPads([makeBoard(), rectPad, innerLayerVia])).toEqual([])
})

test("respects the board via-in-pad allowance", () => {
  expect(checkViasInPads([makeBoard(true), rectPad, viaInRectPad])).toEqual([])
  expect(
    checkViasInPads([makeBoard(false), rectPad, viaInRectPad]),
  ).toHaveLength(1)
})
