import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkCourtyardOverlap } from "lib/check-courtyard-overlap/checkCourtyardOverlap"

const sourceComponent = (id: string, name: string): AnyCircuitElement =>
  ({
    type: "source_component",
    source_component_id: id,
    name,
    ftype: "simple_chip",
  }) as any

const pcbComponent = (
  id: string,
  sourceId: string,
  x: number,
  layer: "top" | "bottom" = "top",
): AnyCircuitElement =>
  ({
    type: "pcb_component",
    pcb_component_id: id,
    source_component_id: sourceId,
    center: { x, y: 0 },
    width: 2,
    height: 2,
    rotation: 0,
    layer,
  }) as any

const squareCourtyardPolygon = (
  id: string,
  componentId: string,
  x: number,
  layer: "top" | "bottom" = "top",
): AnyCircuitElement =>
  ({
    type: "pcb_courtyard_polygon",
    pcb_courtyard_polygon_id: id,
    pcb_component_id: componentId,
    layer,
    points: [
      { x: x - 1, y: -1 },
      { x: x + 1, y: -1 },
      { x: x + 1, y: 1 },
      { x: x - 1, y: 1 },
    ],
  }) as any

const pillCourtyard = (
  id: string,
  componentId: string,
  x: number,
  layer: "top" | "bottom" = "top",
): AnyCircuitElement =>
  ({
    type: "pcb_courtyard_pill",
    pcb_courtyard_pill_id: id,
    pcb_component_id: componentId,
    layer,
    center: { x, y: 0 },
    width: 3,
    height: 1,
    radius: 0.5,
  }) as any

test("checkCourtyardOverlap flags overlapping polygon courtyards", () => {
  // U1 polygon x ∈ [-1, 1], U2 polygon x ∈ [0, 2] (overlap), U3 far away.
  const circuitJson: AnyCircuitElement[] = [
    sourceComponent("sc1", "U1"),
    sourceComponent("sc2", "U2"),
    sourceComponent("sc3", "U3"),
    pcbComponent("pc1", "sc1", 0),
    pcbComponent("pc2", "sc2", 1),
    pcbComponent("pc3", "sc3", 10),
    squareCourtyardPolygon("cy1", "pc1", 0),
    squareCourtyardPolygon("cy2", "pc2", 1),
    squareCourtyardPolygon("cy3", "pc3", 10),
  ]

  const errors = checkCourtyardOverlap(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0].type).toBe("pcb_courtyard_overlap_error")
  expect(errors[0].pcb_component_ids.sort()).toEqual(["pc1", "pc2"])
})

test("checkCourtyardOverlap ignores polygon courtyards on different layers", () => {
  const circuitJson: AnyCircuitElement[] = [
    sourceComponent("sc1", "U1"),
    sourceComponent("sc2", "U2"),
    pcbComponent("pc1", "sc1", 0, "top"),
    pcbComponent("pc2", "sc2", 1, "bottom"),
    squareCourtyardPolygon("cy1", "pc1", 0, "top"),
    squareCourtyardPolygon("cy2", "pc2", 1, "bottom"),
  ]

  expect(checkCourtyardOverlap(circuitJson)).toEqual([])
})

test("checkCourtyardOverlap flags overlapping pill courtyards", () => {
  const overlapping: AnyCircuitElement[] = [
    sourceComponent("sc1", "U1"),
    sourceComponent("sc2", "U2"),
    pcbComponent("pc1", "sc1", 0),
    pcbComponent("pc2", "sc2", 2),
    pillCourtyard("cy1", "pc1", 0),
    pillCourtyard("cy2", "pc2", 2),
  ]
  const errors = checkCourtyardOverlap(overlapping)
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_component_ids.sort()).toEqual(["pc1", "pc2"])

  const separated: AnyCircuitElement[] = [
    sourceComponent("sc1", "U1"),
    sourceComponent("sc2", "U2"),
    pcbComponent("pc1", "sc1", 0),
    pcbComponent("pc2", "sc2", 10),
    pillCourtyard("cy1", "pc1", 0),
    pillCourtyard("cy2", "pc2", 10),
  ]
  expect(checkCourtyardOverlap(separated)).toEqual([])
})

test("renders snapshot highlighting overlapping polygon courtyards", () => {
  const board: AnyCircuitElement = {
    type: "pcb_board",
    pcb_board_id: "board",
    center: { x: 0.5, y: 0 },
    width: 8,
    height: 6,
    thickness: 1.4,
    num_layers: 2,
    material: "fr4",
  } as any

  const soup: AnyCircuitElement[] = [
    board,
    sourceComponent("sc1", "U1"),
    sourceComponent("sc2", "U2"),
    pcbComponent("pc1", "sc1", 0),
    pcbComponent("pc2", "sc2", 1),
    squareCourtyardPolygon("cy1", "pc1", 0),
    squareCourtyardPolygon("cy2", "pc2", 1),
  ]

  const errors = checkCourtyardOverlap(soup)
  expect(errors.length).toBeGreaterThan(0)

  const svg = convertCircuitJsonToPcbSvg([...soup, ...errors], {
    shouldDrawErrors: true,
    showCourtyards: true,
  })

  expect(svg.length).toBeGreaterThan(0)
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
