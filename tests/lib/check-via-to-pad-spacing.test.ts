import { expect, test, describe } from "bun:test"
import { checkViaToPadSpacing } from "lib/check-via-to-pad-spacing"
import type { AnyCircuitElement } from "circuit-json"

describe("checkViaToPadSpacing", () => {
  test("returns error when via is too close to a rect pad on same layer", () => {
    const soup: AnyCircuitElement[] = [
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        shape: "rect",
        x: 0,
        y: 0,
        width: 1.0,
        height: 0.5,
        layer: "top",
      },
      {
        type: "pcb_via",
        pcb_via_id: "via1",
        x: 0.7,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
    ] as AnyCircuitElement[]

    // Pad right edge at x=0.5, via left edge at x=0.7-0.3=0.4 → gap = -0.1 (overlapping)
    const errors = checkViaToPadSpacing(soup)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("too close to pad")
  })

  test("no error when via is far enough from rect pad", () => {
    const soup: AnyCircuitElement[] = [
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        shape: "rect",
        x: 0,
        y: 0,
        width: 1.0,
        height: 0.5,
        layer: "top",
      },
      {
        type: "pcb_via",
        pcb_via_id: "via1",
        x: 1.2,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
    ] as AnyCircuitElement[]

    // Pad right edge at x=0.5, via left edge at x=1.2-0.3=0.9 → gap = 0.4
    const errors = checkViaToPadSpacing(soup)
    expect(errors).toHaveLength(0)
  })

  test("no error when via and pad are on different layers", () => {
    const soup: AnyCircuitElement[] = [
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        shape: "rect",
        x: 0,
        y: 0,
        width: 1.0,
        height: 0.5,
        layer: "bottom",
      },
      {
        type: "pcb_via",
        pcb_via_id: "via1",
        x: 0.5,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top"],
      },
    ] as AnyCircuitElement[]

    const errors = checkViaToPadSpacing(soup)
    expect(errors).toHaveLength(0)
  })

  test("returns error when via is too close to a circle pad", () => {
    const soup: AnyCircuitElement[] = [
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        shape: "circle",
        x: 0,
        y: 0,
        radius: 0.5,
        layer: "top",
      },
      {
        type: "pcb_via",
        pcb_via_id: "via1",
        x: 0.8,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
    ] as AnyCircuitElement[]

    // Center-to-center: 0.8, pad radius: 0.5, via radius: 0.3 → gap = 0.0 < 0.2
    const errors = checkViaToPadSpacing(soup)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("too close to pad")
  })

  test("no error when via is far enough from circle pad", () => {
    const soup: AnyCircuitElement[] = [
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        shape: "circle",
        x: 0,
        y: 0,
        radius: 0.5,
        layer: "top",
      },
      {
        type: "pcb_via",
        pcb_via_id: "via1",
        x: 1.2,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
    ] as AnyCircuitElement[]

    // Center-to-center: 1.2, pad radius: 0.5, via radius: 0.3 → gap = 0.4
    const errors = checkViaToPadSpacing(soup)
    expect(errors).toHaveLength(0)
  })

  test("handles pill-shaped pads correctly", () => {
    const soup: AnyCircuitElement[] = [
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        shape: "pill",
        x: 0,
        y: 0,
        width: 2.0,
        height: 1.0,
        radius: 0.5,
        layer: "top",
      },
      {
        type: "pcb_via",
        pcb_via_id: "via1",
        // Place just outside the pill's right semicircle end
        x: 1.3,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
    ] as AnyCircuitElement[]

    // Inner rect: width=1.0, height=0.0 (pill radius=0.5, height=1.0 → inner height=0)
    // Effective radius = via_radius(0.3) + pill_radius(0.5) = 0.8
    // Nearest point on inner rect at origin to via center (1.3, 0): distance from (0.5, 0) to (1.3, 0) = 0.8
    // gap = 0.8 - 0.8 = 0.0 < 0.2
    const errors = checkViaToPadSpacing(soup)
    expect(errors).toHaveLength(1)
  })

  test("returns no errors when there are no vias", () => {
    const soup: AnyCircuitElement[] = [
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        shape: "rect",
        x: 0,
        y: 0,
        width: 1.0,
        height: 0.5,
        layer: "top",
      },
    ] as AnyCircuitElement[]

    const errors = checkViaToPadSpacing(soup)
    expect(errors).toHaveLength(0)
  })

  test("returns no errors when there are no pads", () => {
    const soup: AnyCircuitElement[] = [
      {
        type: "pcb_via",
        pcb_via_id: "via1",
        x: 0,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
    ] as AnyCircuitElement[]

    const errors = checkViaToPadSpacing(soup)
    expect(errors).toHaveLength(0)
  })

  test("respects custom minSpacing parameter", () => {
    const soup: AnyCircuitElement[] = [
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        shape: "rect",
        x: 0,
        y: 0,
        width: 1.0,
        height: 0.5,
        layer: "top",
      },
      {
        type: "pcb_via",
        pcb_via_id: "via1",
        x: 1.0,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
    ] as AnyCircuitElement[]

    // Gap: nearest point on rect (0.5, 0) to via center (1.0, 0) = 0.5, minus via radius 0.3 = 0.2
    // With default minSpacing=0.2, passes (gap == minSpacing)
    expect(checkViaToPadSpacing(soup)).toHaveLength(0)

    // With larger minSpacing=0.3, fails
    expect(checkViaToPadSpacing(soup, { minSpacing: 0.3 })).toHaveLength(1)
  })

  test("detects via too close to pad diagonally", () => {
    const soup: AnyCircuitElement[] = [
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        shape: "rect",
        x: 0,
        y: 0,
        width: 1.0,
        height: 1.0,
        layer: "top",
      },
      {
        type: "pcb_via",
        pcb_via_id: "via1",
        // Near the corner of the pad
        x: 0.7,
        y: 0.7,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
    ] as AnyCircuitElement[]

    // Nearest rect point to (0.7, 0.7) is (0.5, 0.5), distance = sqrt(0.04+0.04) ≈ 0.283
    // gap = 0.283 - 0.3 ≈ -0.017 (overlapping)
    const errors = checkViaToPadSpacing(soup)
    expect(errors).toHaveLength(1)
  })
})
