import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement, PcbPlatedHole, PcbSmtPad } from "circuit-json"
import { checkCopperToBoardEdgeClearance } from "lib/check-copper-to-board-edge-clearance"
import { checkViasOffBoard } from "lib/check-pcb-components-out-of-board/checkViasOffBoard"
import { runAllPlacementChecks } from "lib/run-all-checks"
import {
  copperInsideButBelowClearance,
  equivalentPassingGeometry,
  roundedRectNearChamfer,
  rotatedPlatedPillCrossingAngledEdge,
  sharpRectNearChamfer,
  viaOutsideChamferedCorner,
} from "tests/fixtures/copper-to-board-edge-clearance"

describe("copper-to-board-edge regression fixtures", () => {
  test("finds a via outside a chamfer despite being inside rectangular bounds", () => {
    const errors = checkCopperToBoardEdgeClearance(viaOutsideChamferedCorner)

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("via_outside_chamfer")
    expect(errors[0].message).toContain("measured 0.000mm")
    expect(errors[0].message).toContain("required 0.200mm")
    expect(checkViasOffBoard(viaOutsideChamferedCorner)).toHaveLength(1)
  })

  test("finds a rotated plated pill crossing an angled edge", () => {
    const errors = checkCopperToBoardEdgeClearance(
      rotatedPlatedPillCrossingAngledEdge,
    )

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("plated_pill_crossing_angle")
    expect(errors[0].message).toContain("measured 0.000mm")
  })

  test("finds copper that is inside but below the configured clearance", () => {
    const errors = checkCopperToBoardEdgeClearance(
      copperInsideButBelowClearance,
    )

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("pad_below_clearance")
    expect(errors[0].message).toContain("measured 0.300mm")
    expect(errors[0].message).toContain("required 0.500mm")
  })

  test("accepts equivalent geometry at or above the required clearance", () => {
    expect(checkCopperToBoardEdgeClearance(equivalentPassingGeometry)).toEqual(
      [],
    )
  })

  test("uses rounded rather than sharp copper corners near a chamfer", () => {
    expect(checkCopperToBoardEdgeClearance(roundedRectNearChamfer)).toEqual([])

    const sharpCornerErrors =
      checkCopperToBoardEdgeClearance(sharpRectNearChamfer)
    expect(sharpCornerErrors).toHaveLength(1)
    expect(sharpCornerErrors[0].message).toContain("sharp_rect_near_chamfer")
  })

  test("is registered in runAllPlacementChecks", async () => {
    const errors = await runAllPlacementChecks(copperInsideButBelowClearance)

    expect(
      errors.some(
        (error) =>
          error.type === "pcb_placement_error" &&
          error.pcb_placement_error_id ===
            "copper_too_close_to_board_edge_pad_below_clearance",
      ),
    ).toBe(true)
  })
})

const rectangularBoard: AnyCircuitElement = {
  type: "pcb_board",
  pcb_board_id: "board",
  center: { x: 0, y: 0 },
  width: 10,
  height: 10,
  num_layers: 2,
  thickness: 1.6,
  material: "fr4",
  min_board_edge_clearance: 0.2,
}

const violatingSmtPads: PcbSmtPad[] = [
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "circle",
    shape: "circle",
    x: 4.8,
    y: 0,
    radius: 0.3,
    layer: "top",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "rect",
    shape: "rect",
    x: 4.7,
    y: 0,
    width: 1,
    height: 0.5,
    layer: "top",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "rotated_rect",
    shape: "rotated_rect",
    x: 4.5,
    y: 0,
    width: 1,
    height: 2,
    ccw_rotation: 45,
    layer: "top",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pill",
    shape: "pill",
    x: 4.6,
    y: 0,
    width: 1,
    height: 0.5,
    radius: 0.25,
    layer: "top",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "rotated_pill",
    shape: "rotated_pill",
    x: 4.5,
    y: 0,
    width: 2,
    height: 0.5,
    radius: 0.25,
    ccw_rotation: 45,
    layer: "top",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "polygon",
    shape: "polygon",
    points: [
      { x: 4.5, y: -0.5 },
      { x: 5.2, y: 0 },
      { x: 4.5, y: 0.5 },
    ],
    layer: "top",
  },
]

test.each(violatingSmtPads)("supports $shape SMT copper geometry", (pad) => {
  const errors = checkCopperToBoardEdgeClearance([rectangularBoard, pad])

  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain(pad.pcb_smtpad_id)
})

test("supports rotated oval plated-hole copper geometry", () => {
  const errors = checkCopperToBoardEdgeClearance([
    rectangularBoard,
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "rotated_oval",
      shape: "oval",
      x: 4.5,
      y: 0,
      outer_width: 2,
      outer_height: 0.5,
      hole_width: 1,
      hole_height: 0.25,
      ccw_rotation: 45,
      layers: ["top", "bottom"],
    },
  ])

  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("rotated_oval")
})

test("supports rotated rounded rectangles and rounded plated-hole pads", () => {
  const rotatedRoundedPad: Extract<PcbSmtPad, { shape: "rotated_rect" }> = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "rotated_rounded_rect",
    shape: "rotated_rect",
    x: 3.7,
    y: 0,
    width: 2,
    height: 2,
    corner_radius: 1,
    ccw_rotation: 30,
    layer: "top",
  }
  const roundedPlatedHole: Extract<
    PcbPlatedHole,
    { shape: "circular_hole_with_rect_pad" }
  > = {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "rounded_plated_rect",
    shape: "circular_hole_with_rect_pad",
    hole_shape: "circle",
    pad_shape: "rect",
    x: -3.7,
    y: 0,
    hole_diameter: 0.5,
    hole_offset_x: 0,
    hole_offset_y: 0,
    rect_pad_width: 2,
    rect_pad_height: 2,
    rect_border_radius: 1,
    rect_ccw_rotation: 30,
    layers: ["top", "bottom"],
  }

  expect(
    checkCopperToBoardEdgeClearance([
      rectangularBoard,
      rotatedRoundedPad,
      roundedPlatedHole,
    ]),
  ).toEqual([])

  expect(
    checkCopperToBoardEdgeClearance([
      rectangularBoard,
      { ...rotatedRoundedPad, corner_radius: 0 },
      { ...roundedPlatedHole, rect_border_radius: 0 },
    ]),
  ).toHaveLength(2)
})

test("applies component rotation to a plated-hole polygon pad", () => {
  const errors = checkCopperToBoardEdgeClearance([
    rectangularBoard,
    {
      type: "pcb_component",
      pcb_component_id: "component",
      source_component_id: "source_component",
      center: { x: 4.5, y: 0 },
      width: 2,
      height: 0.5,
      layer: "top",
      rotation: 90,
      obstructs_within_bounds: true,
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "polygon_plated_hole",
      pcb_component_id: "component",
      shape: "hole_with_polygon_pad",
      hole_shape: "circle",
      hole_diameter: 0.3,
      hole_offset_x: 0,
      hole_offset_y: 0,
      x: 4.5,
      y: 0,
      pad_outline: [
        { x: -1, y: -0.25 },
        { x: 1, y: -0.25 },
        { x: 1, y: 0.25 },
        { x: -1, y: 0.25 },
      ],
      layers: ["top", "bottom"],
    },
  ])

  expect(errors).toEqual([])
})
