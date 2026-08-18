import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement, PcbVia } from "circuit-json"
import { checkDifferentNetViaPadClearance } from "lib/check-different-net-via-pad-clearance"

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

describe("checkDifferentNetViaPadClearance", () => {
  test("reports different-net via copper pads below pad clearance", () => {
    const circuitJson: AnyCircuitElement[] = [
      { type: "pcb_trace", pcb_trace_id: "trace1", route: [] },
      { type: "pcb_trace", pcb_trace_id: "trace2", route: [] },
      makeVia("via1", "trace1", 0),
      makeVia("via2", "trace2", 0.65),
    ]

    const errors = checkDifferentNetViaPadClearance(circuitJson, {
      minClearance: 0.1,
    })

    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({
      type: "pcb_pad_pad_clearance_error",
      pcb_pad_ids: ["via1", "via2"],
      minimum_clearance: 0.1,
    })
    expect(errors[0].actual_clearance).toBeCloseTo(0.05)
  })

  test("does not report vias on the same net", () => {
    const circuitJson: AnyCircuitElement[] = [
      { type: "pcb_trace", pcb_trace_id: "trace1", route: [] },
      makeVia("via1", "trace1", 0),
      makeVia("via2", "trace1", 0.65),
    ]

    expect(
      checkDifferentNetViaPadClearance(circuitJson, { minClearance: 0.1 }),
    ).toEqual([])
  })

  test("does not report vias without a shared copper layer", () => {
    const circuitJson: AnyCircuitElement[] = [
      { type: "pcb_trace", pcb_trace_id: "trace1", route: [] },
      { type: "pcb_trace", pcb_trace_id: "trace2", route: [] },
      makeVia("via1", "trace1", 0, ["top"]),
      makeVia("via2", "trace2", 0.65, ["bottom"]),
    ]

    expect(
      checkDifferentNetViaPadClearance(circuitJson, { minClearance: 0.1 }),
    ).toEqual([])
  })

  test("does not report vias with sufficient pad clearance", () => {
    const circuitJson: AnyCircuitElement[] = [
      { type: "pcb_trace", pcb_trace_id: "trace1", route: [] },
      { type: "pcb_trace", pcb_trace_id: "trace2", route: [] },
      makeVia("via1", "trace1", 0),
      makeVia("via2", "trace2", 0.7),
    ]

    expect(
      checkDifferentNetViaPadClearance(circuitJson, { minClearance: 0.1 }),
    ).toEqual([])
  })
})
