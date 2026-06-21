import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaPadClearance } from "lib/check-via-pad-clearance"

// Via outer_diameter = 0.6mm → radius = 0.3mm
// SMT pad radius ≈ 0.1mm (0.2×0.2 circle)
// Min clearance default ≈ 0.1mm (JLCPCB min_trace_to_pad_edge_clearance)

describe("checkViaPadClearance", () => {
  test("returns error when via is too close to pad on a different net", () => {
    const soup: AnyCircuitElement[] = [
      // Two independent source traces so the via and pad are on different nets
      { type: "source_trace", source_trace_id: "st1", connected_source_port_ids: [], connected_source_net_ids: [] },
      { type: "source_trace", source_trace_id: "st2", connected_source_port_ids: [], connected_source_net_ids: [] },
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
      // Place pad 0.35mm away — via radius (0.3) + pad radius (~0.1) = 0.4mm edge-to-edge clearance would be needed;
      // gap = 0.35 - 0.3 - 0.1 = -0.05mm → violation
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        pcb_component_id: "comp1",
        pcb_port_id: "port1",
        x: 0.35,
        y: 0,
        width: 0.2,
        height: 0.2,
        shape: "circle" as const,
        layer: "top",
        port_hints: [],
      },
    ]

    const errors = checkViaPadClearance(soup, { minClearance: 0.1 })
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toContain("too close")
    expect(errors[0].actual_clearance).toBeLessThan(0.1)
  })

  test("no error when via is sufficiently far from pad on a different net", () => {
    const soup: AnyCircuitElement[] = [
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
        x: 2,
        y: 0,
        width: 0.2,
        height: 0.2,
        shape: "circle" as const,
        layer: "top",
        port_hints: [],
      },
    ]

    const errors = checkViaPadClearance(soup, { minClearance: 0.1 })
    expect(errors).toHaveLength(0)
  })

  test("no error when via and pad are on the same net (via connMap)", () => {
    const soup: AnyCircuitElement[] = [
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
        x: 0.35,
        y: 0,
        width: 0.2,
        height: 0.2,
        shape: "circle" as const,
        layer: "top",
        port_hints: [],
      },
    ]

    // Inject a connMap that marks via1 and pad1 as connected (same net)
    const connMap = {
      areIdsConnected: (a: string, b: string) =>
        (a === "via1" && b === "pad1") || (a === "pad1" && b === "via1"),
      getIdsConnectedToId: () => [],
      getNetIdForId: () => undefined,
    } as any

    const errors = checkViaPadClearance(soup, { minClearance: 0.1, connMap })
    expect(errors).toHaveLength(0)
  })

  test("returns no errors when there are no vias", () => {
    const soup: AnyCircuitElement[] = [
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        pcb_component_id: "comp1",
        pcb_port_id: "port1",
        x: 0,
        y: 0,
        width: 0.5,
        height: 0.5,
        shape: "rect" as const,
        layer: "top",
        port_hints: [],
      },
    ]

    const errors = checkViaPadClearance(soup, { minClearance: 0.1 })
    expect(errors).toHaveLength(0)
  })
})
