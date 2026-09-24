import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement, PcbVia } from "circuit-json"
import { checkDifferentNetViaSpacing } from "lib/check-different-net-via-spacing"

const makeVia = (
  id: string,
  traceId: string,
  x: number,
  layers: PcbVia["layers"] = ["top", "bottom"],
): PcbVia => ({
  type: "pcb_via",
  pcb_via_id: id,
  pcb_trace_id: traceId,
  x,
  y: 0,
  hole_diameter: 0.3,
  outer_diameter: 0.6,
  layers,
})

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
        x: 0.35,
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

  test("no error for duplicate vias at the same location on different nets", () => {
    const circuitJson: AnyCircuitElement[] = [
      { type: "pcb_trace", pcb_trace_id: "trace1", route: [] },
      { type: "pcb_trace", pcb_trace_id: "trace2", route: [] },
      {
        type: "pcb_via",
        pcb_via_id: "via1",
        pcb_trace_id: "trace1",
        x: 1.9047,
        y: 1,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
      {
        type: "pcb_via",
        pcb_via_id: "via2",
        pcb_trace_id: "trace2",
        x: 1.9047,
        y: 1,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
    ]

    const errors = checkDifferentNetViaSpacing(circuitJson)
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

  test("returns a pad clearance error when copper is too close but drill holes are not", () => {
    const circuitJson: AnyCircuitElement[] = [
      { type: "pcb_trace", pcb_trace_id: "trace1", route: [] },
      { type: "pcb_trace", pcb_trace_id: "trace2", route: [] },
      makeVia("via1", "trace1", 0),
      makeVia("via2", "trace2", 0.65),
    ]

    const errors = checkDifferentNetViaSpacing(circuitJson, {
      minClearance: 0.1,
      minPadClearance: 0.1,
    })

    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      type: "pcb_pad_pad_clearance_error",
      pcb_pad_ids: ["via1", "via2"],
      minimum_clearance: 0.1,
    })
    expect(errors[0].actual_clearance).toBeCloseTo(0.05)
  })

  test("does not apply pad clearance to vias without a shared copper layer", () => {
    const circuitJson: AnyCircuitElement[] = [
      { type: "pcb_trace", pcb_trace_id: "trace1", route: [] },
      { type: "pcb_trace", pcb_trace_id: "trace2", route: [] },
      makeVia("via1", "trace1", 0, ["top"]),
      makeVia("via2", "trace2", 0.65, ["bottom"]),
    ]

    expect(
      checkDifferentNetViaSpacing(circuitJson, {
        minClearance: 0.1,
        minPadClearance: 0.1,
      }),
    ).toEqual([])
  })

  test("prefers one drill-hole error when both clearances fail", () => {
    const circuitJson: AnyCircuitElement[] = [
      { type: "pcb_trace", pcb_trace_id: "trace1", route: [] },
      { type: "pcb_trace", pcb_trace_id: "trace2", route: [] },
      makeVia("via1", "trace1", 0),
      makeVia("via2", "trace2", 0.35),
    ]

    const errors = checkDifferentNetViaSpacing(circuitJson, {
      minClearance: 0.1,
      minPadClearance: 0.1,
    })

    expect(errors).toHaveLength(1)
    expect(errors[0].type).toBe("pcb_via_clearance_error")
  })
})
