import { expect, test, describe } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import type { AnyCircuitElement, PcbTrace, PcbVia } from "circuit-json"
import { DEFAULT_TRACE_MARGIN } from "lib/drc-defaults"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { cju } from "@tscircuit/circuit-json-util"

describe("PCB vias in non-overlapping trace checks", () => {
  test("non-overlapping functionality should include vias as collidable objects", () => {
    // Simple test to verify vias are included in the check
    const testData = [
      {
        type: "pcb_trace",
        id: "trace1",
        pcb_trace_id: "trace1",
        layer: "top",
        width: 0.15,
        route: [
          { x: 0, y: 0, layer: "top", route_type: "wire" },
          { x: 10, y: 0, layer: "top", route_type: "wire" },
        ],
      },
      {
        type: "pcb_via",
        pcb_via_id: "via1",
        x: 5,
        y: 0.4,
        hole_diameter: 0.4,
        outer_diameter: 0.6,
        layers: ["top", "bottom"],
      },
    ] as Array<PcbTrace | PcbVia>

    // The via is directly on the trace and has a different net, so should generate an error
    const errors = checkEachPcbTraceNonOverlapping(testData)
    expect(errors).toMatchInlineSnapshot(`[]`)
    expect(errors.length).toBeGreaterThan(0)
  })
})
