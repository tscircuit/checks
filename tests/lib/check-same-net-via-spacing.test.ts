import { expect, test, describe } from "bun:test"
import { checkSameNetViaSpacing } from "lib/check-same-net-via-spacing"
import type { AnyCircuitElement } from "circuit-json"

describe("checkSameNetViaSpacing", () => {
  test("returns error when same-net vias are too close", () => {
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
    const errors = checkSameNetViaSpacing(soup)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("are too close together")
  })

  test("no error when same-net vias are sufficiently spaced", () => {
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
        x: 1.2,
        y: 0,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
    ]
    const errors = checkSameNetViaSpacing(soup)
    expect(errors).toHaveLength(0)
  })

  test("no error when vias on different nets are close", () => {
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
    const errors = checkSameNetViaSpacing(soup)
    expect(errors).toHaveLength(0)
  })
})
