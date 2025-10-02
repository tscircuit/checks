import { describe, expect, test } from "bun:test"
import { checkSourceTracesHavePcbTraces } from "lib/check-source-traces-have-pcb-traces"

describe("checkSourceTracesHavePcbTraces - real-world autorouting failure", () => {
  test("detects disconnected traces from CH32V003F4P6 circuit autorouting failure", () => {
    // This reproduces the exact issue from the user's CH32V003F4P6 + resistor + capacitor + LED circuit
    // Based on the circuit code provided - when autorouting fails, source traces exist but no PCB traces
    const circuitJsonWithFailedAutorouting = [
      // Source traces that would be generated from the user's circuit connections
      {
        type: "source_trace",
        source_trace_id: "trace_net_VDD",
        connected_source_port_ids: [], // Empty because autorouting failed
        connected_source_net_ids: ["net_VDD"],
        display_name: "net.VDD",
        subcircuit_id: "main",
      },
      {
        type: "source_trace",
        source_trace_id: "trace_net_GND",
        connected_source_port_ids: [], // Empty because autorouting failed
        connected_source_net_ids: ["net_GND"],
        display_name: "net.GND",
        subcircuit_id: "main",
      },
      {
        type: "source_trace",
        source_trace_id: "trace_net_BOARD_RX",
        // connected_source_port_ids undefined for some failed traces
        connected_source_net_ids: ["net_BOARD_RX"],
        display_name: "net.BOARD_RX",
        subcircuit_id: "main",
      },
      {
        type: "source_trace",
        source_trace_id: "trace_net_RST",
        connected_source_port_ids: [],
        connected_source_net_ids: ["net_RST"],
        display_name: "net.RST",
        subcircuit_id: "main",
      },
      // PCB ports from the actual circuit components
      // CH32V003F4P6 U1 ports
      {
        type: "pcb_port",
        pcb_port_id: "U1_pin9_VDD",
        source_port_id: "U1_VDD",
        pcb_component_id: "U1",
        x: 0,
        y: 0,
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "U1_pin7_VSS",
        source_port_id: "U1_VSS",
        pcb_component_id: "U1",
        x: 0,
        y: -2,
        layers: ["top"],
      },
      // Resistor R1 (pullup resistor)
      {
        type: "pcb_port",
        pcb_port_id: "R1_pos",
        source_port_id: "R1_pos",
        pcb_component_id: "R1",
        x: 10,
        y: 2,
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "R1_neg",
        source_port_id: "R1_neg",
        pcb_component_id: "R1",
        x: 10,
        y: 0,
        layers: ["top"],
      },
      // Capacitor C1 (decoupling capacitor)
      {
        type: "pcb_port",
        pcb_port_id: "C1_anode",
        source_port_id: "C1_anode",
        pcb_component_id: "C1",
        x: 7,
        y: 2,
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "C1_cathode",
        source_port_id: "C1_cathode",
        pcb_component_id: "C1",
        x: 7,
        y: 0,
        layers: ["top"],
      },
      // LED circuit ports
      {
        type: "pcb_port",
        pcb_port_id: "R2_pos",
        source_port_id: "R2_pos",
        pcb_component_id: "R2",
        x: 9,
        y: -3,
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "LED_PWR_neg",
        source_port_id: "LED_PWR_neg",
        pcb_component_id: "LED_PWR",
        x: 9,
        y: -6,
        layers: ["top"],
      },
    ]

    const errors = checkSourceTracesHavePcbTraces(
      circuitJsonWithFailedAutorouting as any,
    )

    // Should detect all 4 disconnected traces from the CH32V003F4P6 circuit
    expect(errors).toHaveLength(4)

    // Check error messages indicate routing failure
    expect(errors[0].message).toContain("failed to route")
    expect(errors[1].message).toContain("failed to route")
    expect(errors[2].message).toContain("failed to route")
    expect(errors[3].message).toContain("failed to route")

    // Check correct source trace IDs are identified (matches the user's circuit nets)
    const errorTraceIds = errors.map((e) => e.source_trace_id).sort()
    expect(errorTraceIds).toEqual([
      "trace_net_BOARD_RX",
      "trace_net_GND",
      "trace_net_RST",
      "trace_net_VDD",
    ])

    // Verify error type
    expect(errors[0].type).toBe("pcb_trace_missing_error")
  })

  test("does not error when CH32V003F4P6 circuit autorouting succeeds", () => {
    // Same CH32V003F4P6 circuit but with successful autorouting - PCB traces generated
    const circuitJsonWithSuccessfulAutorouting = [
      {
        type: "source_trace",
        source_trace_id: "trace_net_VDD",
        connected_source_port_ids: ["U1_VDD", "R1_pos", "C1_anode", "R2_pos"],
        connected_source_net_ids: ["net_VDD"],
        display_name: "net.VDD",
      },
      {
        type: "source_trace",
        source_trace_id: "trace_net_GND",
        connected_source_port_ids: ["U1_VSS", "C1_cathode", "LED_PWR_neg"],
        connected_source_net_ids: ["net_GND"],
        display_name: "net.GND",
      },
      // PCB traces successfully generated by autorouter
      {
        type: "pcb_trace",
        pcb_trace_id: "pcb_trace_VDD",
        source_trace_id: "trace_net_VDD",
        route: [
          { route_type: "wire", x: 0, y: 0, width: 0.1, layer: "top" },
          { route_type: "wire", x: 10, y: 2, width: 0.1, layer: "top" },
          { route_type: "wire", x: 7, y: 2, width: 0.1, layer: "top" },
          { route_type: "wire", x: 9, y: -3, width: 0.1, layer: "top" },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "pcb_trace_GND",
        source_trace_id: "trace_net_GND",
        route: [
          { route_type: "wire", x: 0, y: -2, width: 0.1, layer: "top" },
          { route_type: "wire", x: 7, y: 0, width: 0.1, layer: "top" },
          { route_type: "wire", x: 9, y: -6, width: 0.1, layer: "top" },
        ],
      },
    ]

    const errors = checkSourceTracesHavePcbTraces(
      circuitJsonWithSuccessfulAutorouting as any,
    )
    expect(errors).toHaveLength(0)
  })
})
