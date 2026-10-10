import { describe, expect, test } from "bun:test"
import { checkCourtyardOverlap } from "lib/check-courtyard-overlap/checkCourtyardOverlap"
import type { AnyCircuitElement } from "circuit-json"

const polygonCourtyard = (
  id: string,
  comp: string,
  offsetX: number,
): AnyCircuitElement =>
  ({
    type: "pcb_courtyard_polygon",
    pcb_courtyard_polygon_id: id,
    pcb_component_id: comp,
    layer: "top",
    points: [
      { x: offsetX - 1, y: -1 },
      { x: offsetX + 1, y: -1 },
      { x: offsetX + 1, y: 1 },
      { x: offsetX - 1, y: 1 },
    ],
  }) as AnyCircuitElement

const pillCourtyard = (
  id: string,
  comp: string,
  offsetX: number,
): AnyCircuitElement =>
  ({
    type: "pcb_courtyard_pill",
    pcb_courtyard_pill_id: id,
    pcb_component_id: comp,
    layer: "top",
    center: { x: offsetX, y: 0 },
    width: 4,
    height: 1,
    radius: 0.5,
  }) as AnyCircuitElement

const rectCourtyard = (
  id: string,
  comp: string,
  offsetX: number,
): AnyCircuitElement =>
  ({
    type: "pcb_courtyard_rect",
    pcb_courtyard_rect_id: id,
    pcb_component_id: comp,
    layer: "top",
    center: { x: offsetX, y: 0 },
    width: 2,
    height: 2,
  }) as AnyCircuitElement

const component = (id: string): AnyCircuitElement =>
  ({
    type: "pcb_component",
    pcb_component_id: id,
    source_component_id: `source_${id}`,
    center: { x: 0, y: 0 },
    width: 2,
    height: 2,
    layer: "top",
    rotation: 0,
  }) as AnyCircuitElement

describe("checkCourtyardOverlap with polygon and pill courtyards", () => {
  test("overlapping polygon courtyards on the same layer produce an error", () => {
    const circuitJson: AnyCircuitElement[] = [
      component("pc1"),
      component("pc2"),
      polygonCourtyard("cy1", "pc1", 0),
      polygonCourtyard("cy2", "pc2", 0.5),
    ]

    const errors = checkCourtyardOverlap(circuitJson as never)
    expect(errors.length).toBe(1)
    expect(errors[0].error_type).toBe("pcb_courtyard_overlap_error")
  })

  test("overlapping pill courtyards on the same layer produce an error", () => {
    const circuitJson: AnyCircuitElement[] = [
      component("pc1"),
      component("pc2"),
      pillCourtyard("cy1", "pc1", 0),
      pillCourtyard("cy2", "pc2", 0.5),
    ]

    const errors = checkCourtyardOverlap(circuitJson as never)
    expect(errors.length).toBe(1)
    expect(errors[0].error_type).toBe("pcb_courtyard_overlap_error")
  })

  test("non-overlapping polygon and pill courtyards produce no errors", () => {
    const circuitJson: AnyCircuitElement[] = [
      component("pc1"),
      component("pc2"),
      polygonCourtyard("cy1", "pc1", 0),
      pillCourtyard("cy2", "pc2", 10),
    ]

    const errors = checkCourtyardOverlap(circuitJson as never)
    expect(errors.length).toBe(0)
  })

  test("polygon courtyard on bottom layer does not overlap top rect courtyard", () => {
    const circuitJson: AnyCircuitElement[] = [
      component("pc1"),
      component("pc2"),
      polygonCourtyard("cy1", "pc1", 0),
      {
        ...rectCourtyard("cy2", "pc2", 0),
        layer: "bottom",
      } as AnyCircuitElement,
    ]

    const errors = checkCourtyardOverlap(circuitJson as never)
    expect(errors.length).toBe(0)
  })

  test("rect vs rect baseline still detects overlap", () => {
    const circuitJson: AnyCircuitElement[] = [
      component("pc1"),
      component("pc2"),
      rectCourtyard("cy1", "pc1", 0),
      rectCourtyard("cy2", "pc2", 0.5),
    ]

    const errors = checkCourtyardOverlap(circuitJson as never)
    expect(errors.length).toBe(1)
  })
})

const freePill = (
  id: string,
  comp: string,
  opts: { width: number; height: number; radius: number; x?: number },
): AnyCircuitElement =>
  ({
    type: "pcb_courtyard_pill",
    pcb_courtyard_pill_id: id,
    pcb_component_id: comp,
    layer: "top",
    center: { x: opts.x ?? 0, y: 0 },
    width: opts.width,
    height: opts.height,
    radius: opts.radius,
  }) as AnyCircuitElement

const smallRect = (
  id: string,
  comp: string,
  center: { x: number; y: number },
): AnyCircuitElement =>
  ({
    type: "pcb_courtyard_rect",
    pcb_courtyard_rect_id: id,
    pcb_component_id: comp,
    layer: "top",
    center,
    width: 0.4,
    height: 0.4,
  }) as AnyCircuitElement

describe("checkCourtyardOverlap with out-of-spec pill courtyards", () => {
  // `radius` is unconstrained by the circuit-json schema, but the sampled ring
  // is only valid when radius <= height / 2 and 2 * radius <= width. Otherwise
  // the two caps cross and the self-intersecting ring resolves to a shape that
  // reaches far past the declared width/height.

  test("radius taller than the body does not overlap a courtyard outside the declared height", () => {
    // pill is 4 x 1, so it covers y in [-0.5, 0.5]; the rect is at y = 1.5
    const circuitJson: AnyCircuitElement[] = [
      component("pc1"),
      component("pc2"),
      freePill("cy1", "pc1", { width: 4, height: 1, radius: 2 }),
      smallRect("cy2", "pc2", { x: 0, y: 1.5 }),
    ]

    const errors = checkCourtyardOverlap(circuitJson as never)
    expect(errors.length).toBe(0)
  })

  test("radius wider than the body does not overlap an identical pill beyond the declared width", () => {
    // each pill is 1 wide, so at x = 0 and x = 2.6 they cannot touch
    const circuitJson: AnyCircuitElement[] = [
      component("pc1"),
      component("pc2"),
      freePill("cy1", "pc1", { width: 1, height: 4, radius: 2 }),
      freePill("cy2", "pc2", { width: 1, height: 4, radius: 2, x: 2.6 }),
    ]

    const errors = checkCourtyardOverlap(circuitJson as never)
    expect(errors.length).toBe(0)
  })

  test("out-of-spec pills still report genuine overlaps", () => {
    const circuitJson: AnyCircuitElement[] = [
      component("pc1"),
      component("pc2"),
      freePill("cy1", "pc1", { width: 4, height: 1, radius: 2 }),
      smallRect("cy2", "pc2", { x: 0, y: 0 }),
    ]

    const errors = checkCourtyardOverlap(circuitJson as never)
    expect(errors.length).toBe(1)
  })

  test("spec-conformant pills are unaffected by the clamp", () => {
    // radius 0.5 === height / 2 and 2 * radius <= width
    const overlapping: AnyCircuitElement[] = [
      component("pc1"),
      component("pc2"),
      freePill("cy1", "pc1", { width: 4, height: 1, radius: 0.5 }),
      smallRect("cy2", "pc2", { x: 1.9, y: 0 }),
    ]
    const separated: AnyCircuitElement[] = [
      component("pc1"),
      component("pc2"),
      freePill("cy1", "pc1", { width: 4, height: 1, radius: 0.5 }),
      smallRect("cy2", "pc2", { x: 2.3, y: 0 }),
    ]

    expect(checkCourtyardOverlap(overlapping as never).length).toBe(1)
    expect(checkCourtyardOverlap(separated as never).length).toBe(0)
  })
})
