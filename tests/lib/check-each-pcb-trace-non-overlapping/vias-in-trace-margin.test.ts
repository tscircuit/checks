import { expect, test, describe } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import circuitJson from "../../assets/via-too-close-to-trace.json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"

describe("PCB vias in non-overlapping trace checks", () => {
  test("non-overlapping functionality should include vias as collidable objects", async () => {
    const errors = checkEachPcbTraceNonOverlapping(circuitJson as any)

    expect(errors).toMatchInlineSnapshot(`
      [
        {
          "center": {
            "x": 2.143385148180965,
            "y": -0.13905158630535422,
          },
          "error_type": "pcb_trace_error",
          "message": "PCB trace trace[source_trace_0_0] overlaps with pcb_via "pcb_via[#pcb_via_0]" (gap: 0.086mm)",
          "pcb_component_ids": [],
          "pcb_port_ids": [],
          "pcb_trace_error_id": "overlap_source_trace_0_0_pcb_via_0",
          "pcb_trace_id": "source_trace_0_0",
          "source_trace_id": "",
          "type": "pcb_trace_error",
        },
      ]
    `)
    expect(errors.length).toBeGreaterThan(0)
    const svg = convertCircuitJsonToPcbSvg(circuitJson as any)
    await expect(svg).toMatchSvgSnapshot(import.meta.path)
  })
})
