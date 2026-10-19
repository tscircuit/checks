import { expect, spyOn, test } from "bun:test"
import type { AnyCircuitElement, SourceTrace } from "circuit-json"
import { getReadableNameForSourceTrace } from "lib/util/get-readable-names"

test("trace names use the first two readable ports without looking up the rest", (): void => {
  const circuit: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "source_component_a",
      ftype: "simple_resistor",
      resistance: 1000,
      name: "R1",
    },
    {
      type: "source_component",
      source_component_id: "source_component_b",
      ftype: "simple_resistor",
      resistance: 1000,
      name: "U1",
    },
    {
      type: "source_port",
      source_port_id: "source_port_hidden",
      source_component_id: "source_component_missing",
      name: "source_port_hidden",
    },
    {
      type: "source_port",
      source_port_id: "source_port_a",
      source_component_id: "source_component_a",
      name: "OUT",
    },
    {
      type: "source_port",
      source_port_id: "source_port_b",
      source_component_id: "source_component_b",
      name: "IN",
    },
    {
      type: "source_port",
      source_port_id: "source_port_b",
      source_component_id: "source_component_b",
      name: "SHOULD_NOT_REPLACE_FIRST_MATCH",
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_hidden",
      source_port_id: "source_port_hidden",
      x: 0,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_b",
      source_port_id: "source_port_b",
      x: 1,
      y: 0,
      layers: ["top"],
    },
  ]
  const sourceTrace: SourceTrace = {
    type: "source_trace",
    source_trace_id: "source_trace_private",
    connected_source_port_ids: [
      "source_port_missing",
      "source_port_hidden",
      "source_port_a",
      "source_port_b",
    ],
    connected_source_net_ids: [],
  }
  const findCalls = spyOn(circuit, "find")
  try {
    expect(getReadableNameForSourceTrace(circuit, sourceTrace)).toBe(
      "R1.OUT to U1.IN",
    )
    const lookupsForTwoNames = findCalls.mock.calls.length
    findCalls.mockClear()
    expect(
      getReadableNameForSourceTrace(circuit, {
        ...sourceTrace,
        connected_source_port_ids: [
          ...sourceTrace.connected_source_port_ids,
          ...Array.from({ length: 500 }, (_, index) => `unused_${index}`),
        ],
      }),
    ).toBe("R1.OUT to U1.IN")
    expect(findCalls.mock.calls.length).toBe(lookupsForTwoNames)

    expect(
      getReadableNameForSourceTrace(circuit, {
        ...sourceTrace,
        connected_source_port_ids: ["source_port_missing", "source_port_a"],
      }),
    ).toBe("trace connected to R1.OUT")
    expect(
      getReadableNameForSourceTrace(circuit, {
        ...sourceTrace,
        connected_source_port_ids: [
          "source_port_missing",
          "source_port_hidden",
        ],
      }),
    ).toBe("unnamed trace")
    findCalls.mockClear()
    expect(
      getReadableNameForSourceTrace(circuit, {
        ...sourceTrace,
        display_name: "Clock",
      }),
    ).toBe("Clock")
    expect(findCalls).not.toHaveBeenCalled()
  } finally {
    findCalls.mockRestore()
  }
})
