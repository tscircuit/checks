import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  PcbCourtyardCircle,
  PcbCourtyardOutline,
  PcbCourtyardPolygon,
  PcbCourtyardRect,
  PcbComponent,
  PcbPlatedHoleCircle,
} from "circuit-json"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"
import { doPcbElementsOverlap } from "lib/check-pcb-components-overlap/doPcbElementsOverlap"

const platedHole = (
  overrides: Partial<PcbPlatedHoleCircle> = {},
): PcbPlatedHoleCircle => ({
  type: "pcb_plated_hole",
  pcb_plated_hole_id: "display_pin",
  pcb_component_id: "display",
  shape: "circle",
  x: 0,
  y: 0,
  outer_diameter: 1,
  hole_diameter: 0.5,
  layers: ["top", "bottom"],
  ...overrides,
})

const courtyardRect = (
  overrides: Partial<PcbCourtyardRect> = {},
): PcbCourtyardRect => ({
  type: "pcb_courtyard_rect",
  pcb_courtyard_rect_id: "holder_courtyard",
  pcb_component_id: "holder",
  center: { x: 0, y: 0 },
  width: 4,
  height: 2,
  layer: "bottom",
  ...overrides,
})

const pcbComponent = (
  pcbComponentId: string,
  doNotPlace = false,
): PcbComponent => ({
  type: "pcb_component",
  pcb_component_id: pcbComponentId,
  source_component_id: `source_${pcbComponentId}`,
  center: { x: 0, y: 0 },
  width: 4,
  height: 2,
  layer: "top",
  rotation: 0,
  do_not_place: doNotPlace,
  obstructs_within_bounds: true,
})

test("plated through-hole inside another component's bottom courtyard is reported", () => {
  const circuitJson: AnyCircuitElement[] = [platedHole(), courtyardRect()]

  const errors = checkPcbComponentOverlap(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_plated_hole_ids).toEqual(["display_pin"])
  expect(errors[0].message).toContain("pcb_courtyard_rect")
})

test("plated hole is not compared with its own component courtyard", () => {
  const circuitJson: AnyCircuitElement[] = [
    platedHole(),
    courtyardRect({ pcb_component_id: "display" }),
  ]

  expect(checkPcbComponentOverlap(circuitJson)).toHaveLength(0)
})

test("plated hole and courtyard need a shared physical layer", () => {
  const circuitJson: AnyCircuitElement[] = [
    platedHole({ layers: ["top"] }),
    courtyardRect(),
  ]

  expect(checkPcbComponentOverlap(circuitJson)).toHaveLength(0)
})

test("plated hole from a do-not-place component may overlap another component's courtyard", () => {
  const circuitJson: AnyCircuitElement[] = [
    pcbComponent("display", true),
    pcbComponent("holder"),
    platedHole(),
    courtyardRect(),
  ]

  expect(checkPcbComponentOverlap(circuitJson)).toHaveLength(0)
})

test("courtyard from a do-not-place component may overlap another component's plated hole", () => {
  const circuitJson: AnyCircuitElement[] = [
    pcbComponent("display"),
    pcbComponent("holder", true),
    platedHole(),
    courtyardRect(),
  ]

  expect(checkPcbComponentOverlap(circuitJson)).toHaveLength(0)
})

test("do-not-place components still report plated-hole overlaps", () => {
  const circuitJson: AnyCircuitElement[] = [
    pcbComponent("display", true),
    pcbComponent("holder", true),
    platedHole(),
    platedHole({
      pcb_plated_hole_id: "holder_pin",
      pcb_component_id: "holder",
    }),
  ]

  const errors = checkPcbComponentOverlap(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_plated_hole_ids).toEqual(["display_pin", "holder_pin"])
})

test("rotated courtyard uses its actual shape instead of only its bounds", () => {
  const courtyard = courtyardRect({
    width: 6,
    height: 1,
    ccw_rotation: 45,
  })

  expect(doPcbElementsOverlap(platedHole({ x: 2, y: -2 }), courtyard)).toBe(
    false,
  )
  expect(doPcbElementsOverlap(platedHole({ x: 1, y: 1 }), courtyard)).toBe(true)
})

test("circle, polygon, and outline courtyard geometry is respected", () => {
  const circle: PcbCourtyardCircle = {
    type: "pcb_courtyard_circle",
    pcb_courtyard_circle_id: "circle_courtyard",
    pcb_component_id: "circle_holder",
    center: { x: 0, y: 0 },
    radius: 1,
    layer: "bottom",
  }
  const polygon: PcbCourtyardPolygon = {
    type: "pcb_courtyard_polygon",
    pcb_courtyard_polygon_id: "polygon_courtyard",
    pcb_component_id: "polygon_holder",
    points: [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 0, y: 1 },
    ],
    layer: "bottom",
  }
  const outline: PcbCourtyardOutline = {
    type: "pcb_courtyard_outline",
    pcb_courtyard_outline_id: "outline_courtyard",
    pcb_component_id: "outline_holder",
    outline: [
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
    ],
    layer: "bottom",
  }

  expect(doPcbElementsOverlap(platedHole(), circle)).toBe(true)
  expect(doPcbElementsOverlap(platedHole({ x: 1.6 }), circle)).toBe(false)
  expect(doPcbElementsOverlap(platedHole(), polygon)).toBe(true)
  expect(doPcbElementsOverlap(platedHole({ x: 1.6 }), polygon)).toBe(false)
  expect(doPcbElementsOverlap(platedHole(), outline)).toBe(true)
  expect(doPcbElementsOverlap(platedHole({ x: 1.6 }), outline)).toBe(false)
})
