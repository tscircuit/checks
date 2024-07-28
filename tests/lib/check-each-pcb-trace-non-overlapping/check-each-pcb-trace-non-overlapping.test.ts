import { expect, test, describe } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping"
import type { AnySoupElement, PCBTrace, PCBSMTPad } from "@tscircuit/soup"

describe("checkEachPcbTraceNonOverlapping", () => {
  test("should return no errors when traces don't overlap", () => {
    const soup: AnySoupElement[] = [
      {
        type: "pcb_trace",
        pcb_trace_id: "trace1",
        route: [
          { route_type: "wire", x: 0, y: 0, width: 0.1, layer: "top" },
          { route_type: "wire", x: 1, y: 1, width: 0.1, layer: "top" },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace2",
        route: [
          { route_type: "wire", x: 2, y: 2, width: 0.1, layer: "top" },
          { route_type: "wire", x: 3, y: 3, width: 0.1, layer: "top" },
        ],
      },
    ]
    expect(checkEachPcbTraceNonOverlapping(soup)).toEqual([])
  })

  test("should return an error when traces overlap", async () => {
    const soup: AnySoupElement[] = [
      {
        type: "pcb_trace",
        pcb_trace_id: "trace1",
        route: [
          {
            route_type: "wire",
            x: 0,
            y: 0,
            width: 0.1,
            layer: "top",
            start_pcb_port_id: "port1",
          },
          {
            route_type: "wire",
            x: 1,
            y: 1,
            width: 0.1,
            layer: "top",
            end_pcb_port_id: "port2",
          },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace2",
        route: [
          {
            route_type: "wire",
            x: 0,
            y: 1,
            width: 0.1,
            layer: "top",
            start_pcb_port_id: "port3",
          },
          {
            route_type: "wire",
            x: 1.5,
            y: 0,
            width: 0.1,
            layer: "top",
            end_pcb_port_id: "port4",
          },
        ],
      },
    ]
    const errors = checkEachPcbTraceNonOverlapping(soup)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("overlap")
    expect(errors[0].pcb_trace_id).toBe("trace1")
  })

  test("should not return an error when traces overlap but are on different layers", () => {
    const soup: AnySoupElement[] = [
      {
        type: "pcb_trace",
        pcb_trace_id: "trace1",
        route: [
          { route_type: "wire", x: 0, y: 0, width: 0.1, layer: "top" },
          { route_type: "wire", x: 1, y: 1, width: 0.1, layer: "top" },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace2",
        route: [
          { route_type: "wire", x: 0.5, y: 0.5, width: 0.1, layer: "bottom" },
          { route_type: "wire", x: 1.5, y: 1.5, width: 0.1, layer: "bottom" },
        ],
      },
    ]
    expect(checkEachPcbTraceNonOverlapping(soup)).toEqual([])
  })

  test("should return an error when a trace overlaps with a pcb_smtpad", () => {
    const soup: AnySoupElement[] = [
      {
        type: "pcb_trace",
        pcb_trace_id: "trace1",
        route: [
          { route_type: "wire", x: 0, y: 0, width: 0.1, layer: "top" },
          { route_type: "wire", x: 1, y: 1, width: 0.1, layer: "top" },
        ],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        shape: "rect",
        x: 0.5,
        y: 0.5,
        width: 0.2,
        height: 0.2,
        layer: "top",
      },
    ]
    const errors = checkEachPcbTraceNonOverlapping(soup)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("overlaps with")
    expect(errors[0].pcb_trace_id).toBe("trace1")
  })
})
