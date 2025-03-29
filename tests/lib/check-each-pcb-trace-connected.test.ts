import type { AnySoupElement } from "circuit-json"
import { expect, test, describe } from "bun:test"
import { checkEachPcbTraceConnected } from "lib/check-each-pcb-trace-connected"

describe("checkEachPcbTraceConnected", () => {
  test("should not return error for fully connected traces", () => {
    const soup: AnySoupElement[] = [
      {
        type: "pcb_trace",
        pcb_trace_id: "trace1",
        route: [
          {
            route_type: "wire",
            start_pcb_port_id: "port1",
            x: 0,
            y: 0,
            width: 0.1,
            layer: "top",
          },
          {
            route_type: "wire",
            end_pcb_port_id: "port2",
            x: 4,
            y: 4,
            width: 0.1,
            layer: "top",
          },
        ],
      },
    ]
    const errors = checkEachPcbTraceConnected(soup)
    expect(errors).toHaveLength(0)
  })

  test("should return error for trace not connected at start", () => {
    const soup: AnySoupElement[] = [
      {
        type: "pcb_trace",
        pcb_trace_id: "trace1",
        route: [
          { route_type: "wire", x: 0, y: 0, width: 0.1, layer: "top" }, // Missing start_pcb_port_id
          {
            route_type: "wire",
            end_pcb_port_id: "port2",
            x: 4,
            y: 4,
            width: 0.1,
            layer: "top",
          },
        ],
      },
    ]
    const errors = checkEachPcbTraceConnected(soup)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("not connected at start")
  })

  test("should return error for trace not connected at end", () => {
    const soup: AnySoupElement[] = [
      {
        type: "pcb_trace",
        pcb_trace_id: "trace1",
        route: [
          {
            route_type: "wire",
            start_pcb_port_id: "port1",
            x: 0,
            y: 0,
            width: 0.1,
            layer: "top",
          },
          { route_type: "wire", x: 4, y: 4, width: 0.1, layer: "top" }, // Missing end_pcb_port_id
        ],
      },
    ]
    const errors = checkEachPcbTraceConnected(soup)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("not connected at end")
  })

  test("should return error for trace not connected at both ends", () => {
    const soup: AnySoupElement[] = [
      {
        type: "pcb_trace",
        pcb_trace_id: "trace1",
        route: [
          { route_type: "wire", x: 0, y: 0, width: 0.1, layer: "top" }, // Missing start_pcb_port_id
          { route_type: "wire", x: 4, y: 4, width: 0.1, layer: "top" }, // Missing end_pcb_port_id
        ],
      },
    ]
    const errors = checkEachPcbTraceConnected(soup)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("not connected at start or both ends")
  })

  test("should handle empty soup", () => {
    expect(checkEachPcbTraceConnected([])).toEqual([])
  })

  test("should handle traces with no route segments", () => {
    const soup: AnySoupElement[] = [
      {
        type: "pcb_trace",
        pcb_trace_id: "trace1",
        route: [],
      },
    ]
    const errors = checkEachPcbTraceConnected(soup)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("not connected at start or both ends")
  })
})
