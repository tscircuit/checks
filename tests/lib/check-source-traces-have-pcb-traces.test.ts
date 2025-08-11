import { describe, expect, test } from "bun:test"
import { checkSourceTracesHavePcbTraces } from "lib/check-source-traces-have-pcb-traces"

describe("checkSourceTracesHavePcbTraces", () => {
  test("returns error when source trace has no pcb traces", () => {
    const soup = [
      {
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: ["p1", "p2"],
        connected_source_net_ids: [],
        display_name: "trace1",
      },
    ]

    const errors = checkSourceTracesHavePcbTraces(soup as any)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("trace1")
  })

  test("does not return error when pcb trace exists", () => {
    const soup = [
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

    const errors = checkSourceTracesHavePcbTraces(soup as any)
    expect(errors).toHaveLength(0)
  })
})
