import { expect, test, describe } from "bun:test"
import { checkViaToPadSpacing } from "lib/check-via-to-pad-spacing"
import type { AnyCircuitElement } from "circuit-json"

describe("checkViaToPadSpacing", () => {
  test("returns error when via is too close to an smt rect pad", () => {
    const soup: AnyCircuitElement[] = [
      { type: "pcb_trace", pcb_trace_id: "trace1", route: [] },
      { type: "pcb_trace", pcb_trace_id: "trace2", route: [] },
      {
        type: "pcb_via",
        pcb_via_id: "via1",
        pcb_trace_id: "trace1",
        x: 0,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        pcb_component_id: "comp1",
        pcb_port_id: "port1",
        shape: "rect",
        x: 0.5,
        y: 0,
        width: 0.4,
        height: 0.4,
        layer: "top",
        port_hints: ["1"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "port1",
        source_port_id: "source_port1",
        pcb_component_id: "comp1",
        x: 0.5,
        y: 0,
        layers: ["top"],
      },
      {
        type: "source_port",
        source_port_id: "source_port1",
        source_component_id: "source_comp1",
        name: "pin1",
      },
      {
        type: "pcb_component",
        pcb_component_id: "comp1",
        source_component_id: "source_comp1",
        center: { x: 0.5, y: 0 },
        width: 1,
        height: 1,
        rotation: 0,
        layer: "top",
      },
      {
        type: "source_component",
        source_component_id: "source_comp1",
        ftype: "simple_resistor",
        name: "R1",
        resistance: 1000,
      },
    ] as AnyCircuitElement[]

    const errors = checkViaToPadSpacing(soup)
    expect(errors.length).toBeGreaterThanOrEqual(1)
    expect(errors[0].message).toContain("too close to pad")
  })

  test("no error when via is far from pad", () => {
    const soup: AnyCircuitElement[] = [
      { type: "pcb_trace", pcb_trace_id: "trace1", route: [] },
      {
        type: "pcb_via",
        pcb_via_id: "via1",
        pcb_trace_id: "trace1",
        x: 0,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        pcb_component_id: "comp1",
        pcb_port_id: "port1",
        shape: "rect",
        x: 3,
        y: 0,
        width: 0.4,
        height: 0.4,
        layer: "top",
        port_hints: ["1"],
      },
    ] as AnyCircuitElement[]

    const errors = checkViaToPadSpacing(soup)
    expect(errors).toHaveLength(0)
  })

  test("no error when via and pad are on the same net", () => {
    const soup: AnyCircuitElement[] = [
      {
        type: "pcb_trace",
        pcb_trace_id: "trace1",
        source_trace_id: "source_trace1",
        route: [],
      },
      {
        type: "pcb_via",
        pcb_via_id: "via1",
        pcb_trace_id: "trace1",
        x: 0,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        pcb_component_id: "comp1",
        pcb_port_id: "port1",
        shape: "rect",
        x: 0.5,
        y: 0,
        width: 0.4,
        height: 0.4,
        layer: "top",
        port_hints: ["1"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "port1",
        source_port_id: "source_port1",
        pcb_component_id: "comp1",
        x: 0.5,
        y: 0,
        layers: ["top"],
      },
      {
        type: "source_port",
        source_port_id: "source_port1",
        source_component_id: "source_comp1",
        name: "pin1",
      },
      {
        type: "source_trace",
        source_trace_id: "source_trace1",
        connected_source_port_ids: ["source_port1"],
        connected_source_net_ids: [],
      },
      {
        type: "pcb_component",
        pcb_component_id: "comp1",
        source_component_id: "source_comp1",
        center: { x: 0.5, y: 0 },
        width: 1,
        height: 1,
        rotation: 0,
        layer: "top",
      },
      {
        type: "source_component",
        source_component_id: "source_comp1",
        ftype: "simple_resistor",
        name: "R1",
        resistance: 1000,
      },
    ] as AnyCircuitElement[]

    // Via trace1 connects via1; pad1 connects through port1 -> source_port1 -> source_trace1 -> trace1
    // The connectivity map should show them as connected via the trace
    const errors = checkViaToPadSpacing(soup)
    expect(errors).toHaveLength(0)
  })

  test("no error when via and pad are on different layers", () => {
    const soup: AnyCircuitElement[] = [
      { type: "pcb_trace", pcb_trace_id: "trace1", route: [] },
      {
        type: "pcb_via",
        pcb_via_id: "via1",
        pcb_trace_id: "trace1",
        x: 0,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top"],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        pcb_component_id: "comp1",
        pcb_port_id: "port1",
        shape: "rect",
        x: 0.5,
        y: 0,
        width: 0.4,
        height: 0.4,
        layer: "bottom",
        port_hints: ["1"],
      },
    ] as AnyCircuitElement[]

    const errors = checkViaToPadSpacing(soup)
    expect(errors).toHaveLength(0)
  })

  test("returns error when via is too close to a circle smt pad", () => {
    const soup: AnyCircuitElement[] = [
      { type: "pcb_trace", pcb_trace_id: "trace1", route: [] },
      { type: "pcb_trace", pcb_trace_id: "trace2", route: [] },
      {
        type: "pcb_via",
        pcb_via_id: "via1",
        pcb_trace_id: "trace1",
        x: 0,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        pcb_component_id: "comp1",
        pcb_port_id: "port1",
        shape: "circle",
        x: 0.5,
        y: 0,
        radius: 0.2,
        layer: "top",
        port_hints: ["1"],
      },
    ] as AnyCircuitElement[]

    // gap = 0.5 - 0.3 - 0.2 = 0.0 < 0.2 default
    const errors = checkViaToPadSpacing(soup)
    expect(errors.length).toBeGreaterThanOrEqual(1)
    expect(errors[0].message).toContain("too close to pad")
  })

  test("returns error when via is too close to a plated hole", () => {
    const soup: AnyCircuitElement[] = [
      { type: "pcb_trace", pcb_trace_id: "trace1", route: [] },
      { type: "pcb_trace", pcb_trace_id: "trace2", route: [] },
      {
        type: "pcb_via",
        pcb_via_id: "via1",
        pcb_trace_id: "trace1",
        x: 0,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
      {
        type: "pcb_plated_hole",
        pcb_plated_hole_id: "ph1",
        pcb_component_id: "comp1",
        pcb_port_id: "port1",
        shape: "circle",
        x: 0.5,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
        port_hints: ["1"],
      },
    ] as AnyCircuitElement[]

    // gap = 0.5 - 0.3 - 0.3 = -0.1 < 0.2 default
    const errors = checkViaToPadSpacing(soup)
    expect(errors.length).toBeGreaterThanOrEqual(1)
    expect(errors[0].message).toContain("too close to pad")
  })
})
