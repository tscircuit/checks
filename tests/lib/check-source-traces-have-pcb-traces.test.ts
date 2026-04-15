import { describe, expect, test } from "bun:test"
import { checkSourceTracesHavePcbTraces } from "lib/check-source-traces-have-pcb-traces"
import { checkSourceTracesMatchPcbTraceThickness } from "lib/check-source-traces-match-pcb-trace-thickness"

describe("checkSourceTracesHavePcbTraces", () => {
  test("returns error when source trace has no pcb traces", () => {
    const circuitJson = [
      {
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: ["p1", "p2"],
        connected_source_net_ids: [],
        display_name: "trace1",
      },
    ]

    const errors = checkSourceTracesHavePcbTraces(circuitJson as any)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("trace1")
  })

  test("returns error with correct PCB component and port IDs", () => {
    const circuitJson = [
      {
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: ["source_port_1", "source_port_2"],
        connected_source_net_ids: [],
        display_name: "trace1",
      },
      {
        type: "pcb_port",
        pcb_port_id: "pcb_port_1",
        source_port_id: "source_port_1",
        pcb_component_id: "pcb_component_1",
        x: 0,
        y: 0,
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "pcb_port_2",
        source_port_id: "source_port_2",
        pcb_component_id: "pcb_component_2",
        x: 1,
        y: 1,
        layers: ["top"],
      },
    ]

    const errors = checkSourceTracesHavePcbTraces(circuitJson as any)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("trace1")
    expect(errors[0].pcb_component_ids).toEqual([
      "pcb_component_1",
      "pcb_component_2",
    ])
    expect(errors[0].pcb_port_ids).toEqual(["pcb_port_1", "pcb_port_2"])
    expect(errors[0].source_trace_id).toBe("trace1")
  })

  test("does not return error when pcb trace exists", () => {
    const circuitJson = [
      {
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: ["p1", "p2"],
        connected_source_net_ids: [],
        display_name: "trace1",
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "pcb1",
        source_trace_id: "trace1",
        route: [],
      },
    ]

    const errors = checkSourceTracesHavePcbTraces(circuitJson as any)
    expect(errors).toHaveLength(0)
  })

  test("does not return error for net-connected source trace", () => {
    const circuitJson = [
      {
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: ["p1"],
        connected_source_net_ids: ["net.GND"],
        display_name: "trace1",
      },
      {
        type: "pcb_port",
        pcb_port_id: "pcb_port_1",
        source_port_id: "p1",
        pcb_component_id: "pcb_component_1",
        x: 0,
        y: 0,
        layers: ["top"],
      },
    ]

    const errors = checkSourceTracesHavePcbTraces(circuitJson as any)
    expect(errors).toHaveLength(0)
  })
})

describe("checkSourceTracesMatchPcbTraceThickness", () => {
  test("returns error when routed pcb trace is thinner than explicit source trace thickness", () => {
    const circuitJson = [
      {
        type: "source_trace",
        source_trace_id: "source_trace_0",
        connected_source_port_ids: ["source_port_1", "source_port_2"],
        connected_source_net_ids: [],
        display_name: "PWR -> TINY_CHIP.VDD",
        min_trace_thickness: 1,
      },
      {
        type: "pcb_port",
        pcb_port_id: "pcb_port_1",
        source_port_id: "source_port_1",
        pcb_component_id: "pcb_component_1",
        x: -10,
        y: 0,
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "pcb_port_2",
        source_port_id: "source_port_2",
        pcb_component_id: "pcb_component_2",
        x: 10,
        y: 0,
        layers: ["top"],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "source_trace_0_0",
        source_trace_id: "source_trace_0",
        route: [
          { route_type: "wire", x: -10, y: 0, width: 0.15, layer: "top" },
          { route_type: "wire", x: 0, y: 0, width: 0.15, layer: "top" },
          { route_type: "wire", x: 10, y: 0, width: 0.15, layer: "top" },
        ],
      },
    ]

    const errors = checkSourceTracesMatchPcbTraceThickness(circuitJson as any)

    expect(errors).toHaveLength(1)
    expect(errors[0].source_trace_id).toBe("source_trace_0")
    expect(errors[0].pcb_trace_id).toBe("source_trace_0_0")
    expect(errors[0].pcb_port_ids).toEqual(["pcb_port_1", "pcb_port_2"])
    expect(errors[0].pcb_component_ids).toEqual([
      "pcb_component_1",
      "pcb_component_2",
    ])
    expect(errors[0].message).toContain(
      "Trace [PWR -> TINY_CHIP.VDD] is routed thinner than requested",
    )
    expect(errors[0].message).toContain("requested: 1mm")
    expect(errors[0].message).toContain("actual: 0.15mm")
  })

  test("does not return error when routed pcb trace matches explicit source trace thickness", () => {
    const circuitJson = [
      {
        type: "source_trace",
        source_trace_id: "source_trace_0",
        connected_source_port_ids: ["source_port_1", "source_port_2"],
        connected_source_net_ids: [],
        display_name: "PWR -> TINY_CHIP.VDD",
        min_trace_thickness: 0.3,
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "source_trace_0_0",
        source_trace_id: "source_trace_0",
        route: [
          { route_type: "wire", x: -10, y: 0, width: 0.3, layer: "top" },
          { route_type: "wire", x: 10, y: 0, width: 0.3, layer: "top" },
        ],
      },
    ]

    const errors = checkSourceTracesMatchPcbTraceThickness(circuitJson as any)
    expect(errors).toHaveLength(0)
  })
})
