import { expect, test, describe } from "bun:test"
import { checkViaToPadSpacing } from "lib/check-via-to-pad-spacing"
import type { AnyCircuitElement } from "circuit-json"

describe("checkViaToPadSpacing", () => {
  test("returns error when via is too close to a rectangular SMT pad", () => {
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
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        shape: "rect",
        x: 0.5,
        y: 0,
        width: 0.4,
        height: 0.3,
        layer: "top",
      },
    ]
    // Via edge at 0.3, pad left edge at 0.3 => gap = 0mm, well below 0.2mm default
    const errors = checkViaToPadSpacing(soup)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("too close to pad")
  })

  test("no error when via is far from pad", () => {
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
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        shape: "rect",
        x: 2,
        y: 0,
        width: 0.4,
        height: 0.3,
        layer: "top",
      },
    ]
    const errors = checkViaToPadSpacing(soup)
    expect(errors).toHaveLength(0)
  })

  test("returns error when via is too close to a circular SMT pad", () => {
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
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        shape: "circle",
        x: 0.7,
        y: 0,
        radius: 0.2,
        layer: "top",
      },
    ]
    // center-to-center = 0.7, via radius = 0.3, pad radius = 0.2 => gap = 0.2mm
    // gap + EPSILON (0.005) >= 0.2mm minSpacing => no error
    const errors = checkViaToPadSpacing(soup)
    expect(errors).toHaveLength(0)
  })

  test("returns error when via is too close to a plated hole", () => {
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
      {
        type: "pcb_plated_hole",
        pcb_plated_hole_id: "hole1",
        shape: "circle",
        x: 0.6,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.5,
        layers: ["top", "bottom"],
        pcb_component_id: "comp1",
        pcb_port_id: "port1",
      },
    ]
    // center-to-center = 0.6, via radius = 0.3, hole radius = 0.25 => gap = 0.05mm < 0.2mm
    const errors = checkViaToPadSpacing(soup)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("too close to pad")
  })

  test("respects custom minSpacing parameter", () => {
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
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        shape: "rect",
        x: 1.0,
        y: 0,
        width: 0.4,
        height: 0.3,
        layer: "top",
      },
    ]
    // Via edge at 0.3, pad left edge at 0.8 => gap = 0.5mm
    // With default 0.2mm: no error. With 0.6mm: error
    expect(checkViaToPadSpacing(soup)).toHaveLength(0)
    expect(checkViaToPadSpacing(soup, { minSpacing: 0.6 })).toHaveLength(1)
  })

  test("returns empty array when no vias", () => {
    const soup: AnyCircuitElement[] = [
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        shape: "rect",
        x: 0,
        y: 0,
        width: 0.4,
        height: 0.3,
        layer: "top",
      },
    ]
    expect(checkViaToPadSpacing(soup)).toHaveLength(0)
  })

  test("returns empty array when no pads", () => {
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
    ]
    expect(checkViaToPadSpacing(soup)).toHaveLength(0)
  })
})
