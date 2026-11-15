import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbPlatedHole } from "circuit-json"
import { checkPlatedHoleAnnularRing } from "../../lib/check-plated-hole-annular-ring"
import {
  getAnnularRing,
  getPlatedHoleRingGeometry,
} from "../../lib/util/annular-ring-geometry"

const base = {
  type: "pcb_plated_hole" as const,
  x: 0,
  y: 0,
  layers: ["top" as const, "bottom" as const],
}

const ringOf = (platedHole: PcbPlatedHole) => {
  const geometry = getPlatedHoleRingGeometry(platedHole)!
  return getAnnularRing(geometry.hole, geometry.pad)
}

test("circle: ring is (outer - hole) / 2", () => {
  const ok: PcbPlatedHole = {
    ...base,
    pcb_plated_hole_id: "ok",
    shape: "circle",
    hole_diameter: 1,
    outer_diameter: 1.5,
  }
  const thin: PcbPlatedHole = {
    ...ok,
    pcb_plated_hole_id: "thin",
    outer_diameter: 1.2,
  }
  const breakout: PcbPlatedHole = {
    ...ok,
    pcb_plated_hole_id: "breakout",
    outer_diameter: 0.9,
  }

  expect(ringOf(ok)).toBeCloseTo(0.25, 10)
  expect(ringOf(thin)).toBeCloseTo(0.1, 10)

  const errors = checkPlatedHoleAnnularRing([ok, thin, breakout])
  expect(errors.map((error) => error.pcb_placement_error_id)).toEqual([
    "plated_hole_annular_ring_thin",
    "plated_hole_annular_ring_breakout",
  ])
  expect(errors[0].message).toContain("annular ring: 0.1mm, minimum: 0.13mm")
  expect(errors[1].message).toContain("drill breaks out of its copper pad")
})

test("pill and oval: concentric slots use the narrower side", () => {
  // USB-C shell slot: 0.6 x 1.6 drill in a 1 x 2 pad
  const pill: PcbPlatedHole = {
    ...base,
    pcb_plated_hole_id: "pill",
    shape: "pill",
    hole_width: 0.6,
    hole_height: 1.6,
    outer_width: 1,
    outer_height: 2,
    ccw_rotation: 0,
  }
  expect(ringOf(pill)).toBeCloseTo(0.2, 10)
  expect(ringOf({ ...pill, ccw_rotation: 90 })).toBeCloseTo(0.2, 10)
  expect(ringOf({ ...pill, shape: "oval", outer_height: 1.7 })).toBeCloseTo(
    0.05,
    10,
  )
  expect(checkPlatedHoleAnnularRing([pill])).toHaveLength(0)
})

test("circular hole in rect pad honors hole offset and pad rotation", () => {
  const centered: PcbPlatedHole = {
    ...base,
    pcb_plated_hole_id: "centered",
    shape: "circular_hole_with_rect_pad",
    hole_shape: "circle",
    pad_shape: "rect",
    hole_diameter: 0.8,
    rect_pad_width: 1.2,
    rect_pad_height: 2,
    hole_offset_x: 0,
    hole_offset_y: 0,
  }
  expect(ringOf(centered)).toBeCloseTo(0.2, 10)
  // Offset along the long side keeps the ring at 0.2mm...
  expect(ringOf({ ...centered, hole_offset_y: 0.3 })).toBeCloseTo(0.2, 10)
  // ...but rotating the pad 90deg makes the same offset nearly break out
  expect(
    ringOf({ ...centered, hole_offset_y: 0.3, rect_ccw_rotation: 90 }),
  ).toBeCloseTo(-0.1, 10)
  // Offset across the short side leaves 0.05mm
  expect(ringOf({ ...centered, hole_offset_x: 0.15 })).toBeCloseTo(0.05, 10)
})

test("rounded rect pads lose copper at the corners", () => {
  const platedHole: PcbPlatedHole = {
    ...base,
    pcb_plated_hole_id: "corner",
    shape: "circular_hole_with_rect_pad",
    hole_shape: "circle",
    pad_shape: "rect",
    hole_diameter: 1,
    rect_pad_width: 2,
    rect_pad_height: 2,
    hole_offset_x: 0.4,
    hole_offset_y: 0.4,
  }
  expect(ringOf(platedHole)).toBeCloseTo(0.1, 10)
  expect(ringOf({ ...platedHole, rect_border_radius: 0.8 })).toBeCloseTo(
    0.8 - Math.hypot(0.2, 0.2) - 0.5,
    10,
  )
  expect(
    checkPlatedHoleAnnularRing([{ ...platedHole, rect_border_radius: 0.8 }], {
      minAnnularRing: 0.05,
    }),
  ).toHaveLength(1)
  expect(
    checkPlatedHoleAnnularRing([platedHole], { minAnnularRing: 0.05 }),
  ).toHaveLength(0)
})

test("pill holes in rect pads, including independently rotated slots", () => {
  const pillInRect: PcbPlatedHole = {
    ...base,
    pcb_plated_hole_id: "pill_in_rect",
    shape: "pill_hole_with_rect_pad",
    hole_shape: "pill",
    pad_shape: "rect",
    hole_width: 0.6,
    hole_height: 1.6,
    rect_pad_width: 1,
    rect_pad_height: 2,
    hole_offset_x: 0,
    hole_offset_y: 0,
  }
  expect(ringOf(pillInRect)).toBeCloseTo(0.2, 10)

  const rotatedSlot: PcbPlatedHole = {
    ...base,
    pcb_plated_hole_id: "rotated_slot",
    shape: "rotated_pill_hole_with_rect_pad",
    hole_shape: "rotated_pill",
    pad_shape: "rect",
    hole_width: 0.6,
    hole_height: 1.6,
    hole_ccw_rotation: 90,
    rect_pad_width: 1,
    rect_pad_height: 2,
    rect_ccw_rotation: 0,
    hole_offset_x: 0,
    hole_offset_y: 0,
  }
  // The slot now runs across the 1mm side of the pad and cuts through it
  expect(ringOf(rotatedSlot)).toBeCloseTo(-0.3, 10)
  expect(ringOf({ ...rotatedSlot, rect_ccw_rotation: 90 })).toBeCloseTo(0.2, 10)
  expect(
    checkPlatedHoleAnnularRing([pillInRect, rotatedSlot]).map(
      (error) => error.pcb_placement_error_id,
    ),
  ).toEqual(["plated_hole_annular_ring_rotated_slot"])
})

test("polygon pads, including non-convex outlines", () => {
  const square: PcbPlatedHole = {
    ...base,
    x: 10,
    y: 5,
    pcb_plated_hole_id: "square",
    shape: "hole_with_polygon_pad",
    hole_shape: "circle",
    hole_diameter: 1,
    pad_outline: [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
    ],
    hole_offset_x: 0,
    hole_offset_y: 0,
  }
  expect(ringOf(square)).toBeCloseTo(0.5, 10)
  expect(ringOf({ ...square, hole_offset_x: 0.4 })).toBeCloseTo(0.1, 10)

  // L-shaped pad: the drill sits in the lower arm, 0.5mm below the notch edge
  const lShape: PcbPlatedHole = {
    ...square,
    pcb_plated_hole_id: "l_shape",
    pad_outline: [
      { x: -1, y: -1 },
      { x: 2, y: -1 },
      { x: 2, y: 0.2 },
      { x: 0.2, y: 0.2 },
      { x: 0.2, y: 2 },
      { x: -1, y: 2 },
    ],
    hole_diameter: 0.6,
    hole_offset_x: 0.5,
    hole_offset_y: -0.3,
  }
  expect(ringOf(lShape)).toBeCloseTo(0.2, 10)

  const slot: PcbPlatedHole = {
    ...square,
    pcb_plated_hole_id: "slot",
    hole_shape: "pill",
    hole_diameter: undefined,
    hole_width: 1.8,
    hole_height: 0.6,
  }
  // A 1.8mm slot in a 2mm square leaves 0.1mm at the slot ends
  expect(ringOf(slot)).toBeCloseTo(0.1, 10)
  expect(
    checkPlatedHoleAnnularRing([square, lShape, slot]).map(
      (error) => error.pcb_placement_error_id,
    ),
  ).toEqual(["plated_hole_annular_ring_slot"])
})

test("checkPlatedHoleAnnularRing skips elements without dimensions", () => {
  const circuitJson = [
    {
      ...base,
      pcb_plated_hole_id: "broken",
      shape: "circle",
      outer_diameter: 1,
    },
  ] as unknown as AnyCircuitElement[]

  expect(checkPlatedHoleAnnularRing(circuitJson)).toEqual([])
})
