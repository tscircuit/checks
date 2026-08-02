import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace, PcbVia } from "circuit-json"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkViaTraceClearance } from "lib/check-via-trace-clearance"

describe("PCB vias in non-overlapping trace checks", () => {
  test("reports a positive via-trace gap as clearance, not overlap", () => {
    const testData = [
      {
        type: "pcb_trace",
        pcb_trace_id: "trace1",
        route: [
          { x: 0, y: 0, layer: "top", route_type: "wire" },
          { x: 10, y: 0, layer: "top", route_type: "wire" },
        ],
      },
      {
        type: "pcb_via",
        pcb_via_id: "via1",
        x: 5,
        y: 0.37,
        hole_diameter: 0.4,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
    ] as Array<PcbTrace | PcbVia>

    const overlapErrors = checkEachPcbTraceNonOverlapping(testData)
    const clearanceErrors = checkViaTraceClearance(testData)

    expect(overlapErrors).toEqual([])
    expect(clearanceErrors).toHaveLength(1)
    expect(clearanceErrors[0]!.actual_clearance).toBeGreaterThan(0)
  })

  test("allows a trace to overlap a via assigned to the same source net", () => {
    const testData = [
      {
        type: "source_net",
        source_net_id: "source_net_gnd",
        name: "GND",
      },
      {
        type: "source_trace",
        source_trace_id: "source_trace_gnd",
        connected_source_port_ids: [],
        connected_source_net_ids: ["source_net_gnd"],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "pcb_trace_gnd",
        source_trace_id: "source_trace_gnd",
        route: [
          {
            x: 0,
            y: 0,
            width: 0.2,
            layer: "top",
            route_type: "wire",
          },
          {
            x: 10,
            y: 0,
            width: 0.2,
            layer: "top",
            route_type: "wire",
          },
        ],
      },
      {
        type: "pcb_via",
        pcb_via_id: "pcb_via_gnd",
        source_net_id: "source_net_gnd",
        x: 5,
        y: 0,
        hole_diameter: 0.4,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
    ] as AnyCircuitElement[]

    expect(checkEachPcbTraceNonOverlapping(testData)).toEqual([])
    expect(checkViaTraceClearance(testData)).toEqual([])
  })
})
