import { expect, test, describe } from "bun:test"
import { checkTraceSpacing } from "lib/check-trace-spacing"
import type { AnyCircuitElement } from "circuit-json"

describe("checkTraceSpacing", () => {
  test("returns error when traces are too close", () => {
    const soup: AnyCircuitElement[] = [
      {
        type: "pcb_trace",
        pcb_trace_id: "trace1",
        route: [
          { route_type: "wire", x: 0, y: 0, width: 0.1, layer: "top" },
          { route_type: "wire", x: 1, y: 0, width: 0.1, layer: "top" },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace2",
        route: [
          { route_type: "wire", x: 0, y: 0.15, width: 0.1, layer: "top" },
          { route_type: "wire", x: 1, y: 0.15, width: 0.1, layer: "top" },
        ],
      },
    ]
    const errors = checkTraceSpacing(soup, { minSpacing: 0.2 })
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("too close")
  })

  test("no error when traces are far enough", () => {
    const soup: AnyCircuitElement[] = [
      {
        type: "pcb_trace",
        pcb_trace_id: "trace1",
        route: [
          { route_type: "wire", x: 0, y: 0, width: 0.1, layer: "top" },
          { route_type: "wire", x: 1, y: 0, width: 0.1, layer: "top" },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace2",
        route: [
          { route_type: "wire", x: 0, y: 1, width: 0.1, layer: "top" },
          { route_type: "wire", x: 1, y: 1, width: 0.1, layer: "top" },
        ],
      },
    ]
    const errors = checkTraceSpacing(soup, { minSpacing: 0.2 })
    expect(errors).toHaveLength(0)
  })
})
