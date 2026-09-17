import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbComponentOverCutout } from "lib/check-pcb-component-over-cutout"
import { containsCircuitJsonId } from "lib/util/get-readable-names"

const getCircuitJsonWithCutout = (
  cutout: AnyCircuitElement,
): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "source_component_1",
    ftype: "simple_resistor",
    name: "R1",
    resistance: 1000,
    supplier_part_numbers: {},
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_component_1",
    source_component_id: "source_component_1",
    center: { x: 0, y: 0 },
    width: 1,
    height: 1,
    rotation: 0,
    layer: "top",
    obstructs_within_bounds: false,
  },
  cutout,
]

test("cutout overlap message does not leak the raw pcb_cutout_id", () => {
  const errors = checkPcbComponentOverCutout(
    getCircuitJsonWithCutout({
      type: "pcb_cutout",
      pcb_cutout_id: "pcb_cutout_0",
      shape: "rect",
      center: { x: 0, y: 0 },
      width: 2,
      height: 2,
    }),
  )

  expect(errors).toHaveLength(1)
  expect(containsCircuitJsonId(errors[0]!.message)).toBe(false)
  expect(errors[0]!.message).toBe(
    "Component R1 overlaps with rect cutout at (0.00mm, 0.00mm)",
  )
})

test("circle cutout overlap message describes the cutout by shape and location", () => {
  const errors = checkPcbComponentOverCutout(
    getCircuitJsonWithCutout({
      type: "pcb_cutout",
      pcb_cutout_id: "pcb_cutout_0",
      shape: "circle",
      center: { x: 0.25, y: -0.5 },
      radius: 1,
    }),
  )

  expect(errors).toHaveLength(1)
  expect(containsCircuitJsonId(errors[0]!.message)).toBe(false)
  expect(errors[0]!.message).toBe(
    "Component R1 overlaps with circle cutout at (0.25mm, -0.50mm)",
  )
})

test("polygon cutout overlap message uses the polygon centroid location", () => {
  const errors = checkPcbComponentOverCutout(
    getCircuitJsonWithCutout({
      type: "pcb_cutout",
      pcb_cutout_id: "pcb_cutout_0",
      shape: "polygon",
      points: [
        { x: -1, y: -1 },
        { x: 1, y: -1 },
        { x: 1, y: 1 },
        { x: -1, y: 1 },
      ],
    }),
  )

  expect(errors).toHaveLength(1)
  expect(containsCircuitJsonId(errors[0]!.message)).toBe(false)
  expect(errors[0]!.message).toBe(
    "Component R1 overlaps with polygon cutout at (0.00mm, 0.00mm)",
  )
})
