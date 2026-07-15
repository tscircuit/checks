import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement, AnySoupElement } from "circuit-json"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"

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
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: ["port1", "port2"],
        connected_source_net_ids: [],
      },
      {
        type: "source_trace",
        source_trace_id: "trace2",
        connected_source_port_ids: ["port3", "port4"],
        connected_source_net_ids: [],
      },
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

  test("should allow overriding minimum spacing", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: ["port1", "port2"],
        connected_source_net_ids: [],
      },
      {
        type: "source_trace",
        source_trace_id: "trace2",
        connected_source_port_ids: ["port3", "port4"],
        connected_source_net_ids: [],
      },
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
            y: 0,
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
            y: 0.19,
            width: 0.1,
            layer: "top",
            start_pcb_port_id: "port3",
          },
          {
            route_type: "wire",
            x: 1,
            y: 0.19,
            width: 0.1,
            layer: "top",
            end_pcb_port_id: "port4",
          },
        ],
      },
    ]

    expect(checkEachPcbTraceNonOverlapping(circuitJson)).toHaveLength(1)
    expect(
      checkEachPcbTraceNonOverlapping(circuitJson, { minClearance: 0 }),
    ).toEqual([])
  })

  test("reports pad clearance separately from pad overlap", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_board",
        pcb_board_id: "board1",
        center: { x: 0, y: 0 },
        width: 10,
        height: 10,
        thickness: 1.6,
        num_layers: 2,
        material: "fr4",
        min_trace_to_pad_edge_clearance: 0.05,
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace1",
        route: [
          { route_type: "wire", x: 0, y: 0, width: 0.1, layer: "top" },
          { route_type: "wire", x: 1, y: 0, width: 0.1, layer: "top" },
        ],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        shape: "rect",
        x: 0.5,
        y: 0.175,
        width: 0.2,
        height: 0.1,
        layer: "top",
      },
    ]

    expect(checkEachPcbTraceNonOverlapping(circuitJson)).toEqual([])
    expect(
      checkEachPcbTraceNonOverlapping(circuitJson, { minClearance: 0.1 }),
    ).toEqual([])
  })

  test("does not report false positives against a rotated pill pad bounding box", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_trace",
        pcb_trace_id: "trace1",
        route: [
          { route_type: "wire", x: -0.75, y: 0.7, width: 0.1, layer: "top" },
          { route_type: "wire", x: -0.25, y: 0.7, width: 0.1, layer: "top" },
        ],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad1",
        shape: "rotated_pill",
        x: 0,
        y: 0,
        width: 2,
        height: 0.4,
        radius: 0.2,
        ccw_rotation: 45,
        layer: "top",
      },
    ]

    expect(
      checkEachPcbTraceNonOverlapping(circuitJson, { minClearance: 0.1 }),
    ).toEqual([])
  })
})
