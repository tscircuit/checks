import { expect, test, describe } from "bun:test"
import { checkDifferentNetViaSpacing } from "lib/check-different-net-via-spacing"
import type { AnyCircuitElement } from "circuit-json"

describe("checkDifferentNetViaSpacing", () => {
  test("returns error when different-net vias are too close", () => {
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
        type: "pcb_via",
        pcb_via_id: "via2",
        pcb_trace_id: "trace2",
        x: 0.7,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
    ]
    const errors = checkDifferentNetViaSpacing(soup)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("different nets are too close")
  })

  test("no error when different-net vias are sufficiently spaced", () => {
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
        type: "pcb_via",
        pcb_via_id: "via2",
        pcb_trace_id: "trace2",
        x: 1.5,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
    ]
    const errors = checkDifferentNetViaSpacing(soup)
    expect(errors).toHaveLength(0)
  })

  test("no error when same-net vias are close", () => {
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
        type: "pcb_via",
        pcb_via_id: "via2",
        pcb_trace_id: "trace1",
        x: 0.7,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
    ]
    const errors = checkDifferentNetViaSpacing(soup)
    expect(errors).toHaveLength(0)
  })
})
