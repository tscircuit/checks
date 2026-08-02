import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  PcbBoard,
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
  width: 20,
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

test("reports a via whose center is inside an SMD pad", async () => {
  const circuitJson: AnyCircuitElement[] = [makeBoard(), rectPad, viaInRectPad]

  const errors = checkViasInPads(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_placement_error",
    pcb_placement_error_id: "via_in_pad_pcb_via_1_pcb_smtpad_1",
    error_type: "pcb_placement_error",
  })
  expect(errors[0].message).toContain("is inside SMD pad")
  expect(containsCircuitJsonId(errors[0].message)).toBe(false)
  expect(await runAllPlacementChecks(circuitJson)).toContainEqual(errors[0])
})

test("uses true pad geometry for circular, polygon, and plated-hole pads", () => {
  const circuitJson: AnyCircuitElement[] = [
    makeBoard(),
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_circle",
      shape: "circle",
      x: -4,
      y: 0,
      radius: 0.5,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_polygon",
      shape: "polygon",
      points: [
        { x: -0.5, y: -0.5 },
        { x: 0.5, y: -0.5 },
        { x: 0, y: 0.5 },
      ],
      layer: "top",
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "pcb_plated_hole_1",
      shape: "circle",
      x: 4,
      y: 0,
      outer_diameter: 1,
      hole_diameter: 0.5,
      layers: ["top", "bottom"],
    },
    {
      ...viaInRectPad,
      pcb_via_id: "pcb_via_circle",
      x: -4.2,
      y: 0,
    },
    {
      ...viaInRectPad,
      pcb_via_id: "pcb_via_polygon",
      x: 0,
      y: 0,
    },
    {
      ...viaInRectPad,
      pcb_via_id: "pcb_via_plated_hole",
      x: 4,
      y: 0,
    },
  ]

  expect(checkViasInPads(circuitJson)).toHaveLength(3)
})

test("ignores vias outside pads and vias on non-overlapping layers", () => {
  const circuitJson: AnyCircuitElement[] = [
    makeBoard(),
    rectPad,
    {
      ...viaInRectPad,
      pcb_via_id: "pcb_via_outside",
      x: 2,
      y: 2,
    },
    {
      ...viaInRectPad,
      pcb_via_id: "pcb_via_inner_layers",
      x: 0,
      y: 0,
      layers: ["inner1", "inner2"],
    },
  ]

  expect(checkViasInPads(circuitJson)).toEqual([])
})

test("respects the board via-in-pad allowance", () => {
  const allowedCircuit: AnyCircuitElement[] = [
    makeBoard(true),
    rectPad,
    viaInRectPad,
  ]
  const disallowedCircuit: AnyCircuitElement[] = [
    makeBoard(false),
    rectPad,
    viaInRectPad,
  ]

  expect(checkViasInPads(allowedCircuit)).toEqual([])
  expect(checkViasInPads(disallowedCircuit)).toHaveLength(1)
})
