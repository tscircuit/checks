import { describe, expect, test } from "bun:test"
import { checkSourceTracesHavePcbTraces } from "lib/check-source-traces-have-pcb-traces"

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

  test("returns error for traces with empty connected_source_port_ids", () => {
    const circuitJson = [
      {
        type: "source_trace",
        source_trace_id: "trace_failed_routing",
        connected_source_port_ids: [], // Empty array - autorouting failed
        connected_source_net_ids: ["net_VDD"],
        display_name: "net.VDD",
      },
    ]

    const errors = checkSourceTracesHavePcbTraces(circuitJson as any)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("failed to route")
    expect(errors[0].source_trace_id).toBe("trace_failed_routing")
  })

  test("returns error for traces with undefined connected_source_port_ids", () => {
    const circuitJson = [
      {
        type: "source_trace",
        source_trace_id: "trace_no_ports",
        // connected_source_port_ids is undefined
        connected_source_net_ids: ["net_VDD"],
        display_name: "net.VDD",
      },
    ]

    const errors = checkSourceTracesHavePcbTraces(circuitJson as any)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("failed to route")
    expect(errors[0].source_trace_id).toBe("trace_no_ports")
  })
})
