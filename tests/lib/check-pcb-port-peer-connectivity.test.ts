import type { AnyCircuitElement } from "circuit-json"
import { expect, test, describe } from "bun:test"
import { checkPcbPortPeerConnectivity } from "lib/check-pcb-port-peer-connectivity"

describe("checkPcbPortPeerConnectivity", () => {
  test("should return no errors when ports are properly connected to their peers", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_port",
        pcb_port_id: "port1",
        source_port_id: "source1",
        x: 0,
        y: 0,
        pcb_component_id: "comp1",
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "port2",
        source_port_id: "source2",
        x: 4,
        y: 4,
        pcb_component_id: "comp2",
        layers: ["top"],
      },
      {
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: ["source1", "source2"],
        connected_source_net_ids: [],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "pcb_trace1",
        route: [
          {
            route_type: "wire",
            x: 0,
            y: 0,
            start_pcb_port_id: "port1",
            width: 0.1,
            layer: "top",
          },
          {
            route_type: "wire",
            x: 4,
            y: 4,
            end_pcb_port_id: "port2",
            layer: "top",
            width: 0.1,
          },
        ],
      },
    ]

    const errors = checkPcbPortPeerConnectivity(circuitJson)
    expect(errors).toHaveLength(0)
  })

  test("should return errors when ports are not connected to their expected peers", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_port",
        pcb_port_id: "port1",
        source_port_id: "source1",
        x: 0,
        y: 0,
        pcb_component_id: "comp1",
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "port2",
        source_port_id: "source2",
        x: 4,
        y: 4,
        pcb_component_id: "comp2",
        layers: ["top"],
      },
      {
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: ["source1", "source2"],
        connected_source_net_ids: [],
      },
      // No PCB trace connecting port1 to port2
    ]

    const errors = checkPcbPortPeerConnectivity(circuitJson)
    expect(errors).toHaveLength(2)
    expect(errors[0].message).toContain("port1")
    expect(errors[0].message).toContain(
      "not connected to any of its expected peer ports",
    )
    expect(errors[1].message).toContain("port2")
  })

  test("should handle three-way connections correctly", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_port",
        pcb_port_id: "port1",
        source_port_id: "source1",
        x: 0,
        y: 0,
        pcb_component_id: "comp1",
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "port2",
        source_port_id: "source2",
        x: 2,
        y: 0,
        pcb_component_id: "comp2",
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "port3",
        source_port_id: "source3",
        x: 4,
        y: 0,
        pcb_component_id: "comp3",
        layers: ["top"],
      },
      {
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: ["source1", "source2", "source3"],
        connected_source_net_ids: [],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "pcb_trace1",
        route: [
          {
            route_type: "wire",
            x: 0,
            y: 0,
            start_pcb_port_id: "port1",
            width: 0.1,
            layer: "top",
          },
          {
            route_type: "wire",
            x: 2,
            y: 0,
            layer: "top",
            width: 0.1,
          },
          {
            route_type: "wire",
            x: 4,
            y: 0,
            end_pcb_port_id: "port3",
            layer: "top",
            width: 0.1,
          },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "pcb_trace2",
        route: [
          {
            route_type: "wire",
            x: 2,
            y: 0,
            start_pcb_port_id: "port2",
            end_pcb_port_id: "port1", // Connect port2 to the main trace
            width: 0.1,
            layer: "top",
          },
        ],
      },
    ]

    const errors = checkPcbPortPeerConnectivity(circuitJson)
    expect(errors).toHaveLength(0) // All ports should be connected to at least one peer
  })

  test("should return error when only one port in three-way connection is isolated", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_port",
        pcb_port_id: "port1",
        source_port_id: "source1",
        x: 0,
        y: 0,
        pcb_component_id: "comp1",
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "port2",
        source_port_id: "source2",
        x: 2,
        y: 0,
        pcb_component_id: "comp2",
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "port3",
        source_port_id: "source3",
        x: 4,
        y: 0,
        pcb_component_id: "comp3",
        layers: ["top"],
      },
      {
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: ["source1", "source2", "source3"],
        connected_source_net_ids: [],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "pcb_trace1",
        route: [
          {
            route_type: "wire",
            x: 0,
            y: 0,
            start_pcb_port_id: "port1",
            end_pcb_port_id: "port2",
            width: 0.1,
            layer: "top",
          },
        ],
      },
      // port3 is not connected to any other ports
    ]

    const errors = checkPcbPortPeerConnectivity(circuitJson)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("port3")
    expect(errors[0].message).toContain(
      "not connected to any of its expected peer ports",
    )
  })

  test("should ignore ports with no source trace connections", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_port",
        pcb_port_id: "port1",
        source_port_id: "source1",
        x: 0,
        y: 0,
        pcb_component_id: "comp1",
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "port2",
        source_port_id: "source2",
        x: 2,
        y: 0,
        pcb_component_id: "comp2",
        layers: ["top"],
      },
      {
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: [], // Empty - no connections expected
        connected_source_net_ids: [],
      },
    ]

    const errors = checkPcbPortPeerConnectivity(circuitJson)
    expect(errors).toHaveLength(0) // Should ignore ports with no expected connections
  })

  test("should ignore ports in single-port source traces", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_port",
        pcb_port_id: "port1",
        source_port_id: "source1",
        x: 0,
        y: 0,
        pcb_component_id: "comp1",
        layers: ["top"],
      },
      {
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: ["source1"], // Only one port - no peers to connect to
        connected_source_net_ids: [],
      },
    ]

    const errors = checkPcbPortPeerConnectivity(circuitJson)
    expect(errors).toHaveLength(0) // Should ignore single-port traces
  })

  test("should handle multi-segment traces correctly", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_port",
        pcb_port_id: "port1",
        source_port_id: "source1",
        x: 0,
        y: 0,
        pcb_component_id: "comp1",
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "port2",
        source_port_id: "source2",
        x: 4,
        y: 4,
        pcb_component_id: "comp2",
        layers: ["top"],
      },
      {
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: ["source1", "source2"],
        connected_source_net_ids: [],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "pcb_trace1",
        route: [
          {
            route_type: "wire",
            x: 0,
            y: 0,
            start_pcb_port_id: "port1",
            width: 0.1,
            layer: "top",
          },
          {
            route_type: "wire",
            x: 2,
            y: 2,
            layer: "top",
            width: 0.1,
          },
          {
            route_type: "wire",
            x: 4,
            y: 4,
            end_pcb_port_id: "port2",
            layer: "top",
            width: 0.1,
          },
        ],
      },
    ]

    const errors = checkPcbPortPeerConnectivity(circuitJson)
    expect(errors).toHaveLength(0) // Multi-segment trace should connect the ports
  })

  test("should handle traces with vias correctly", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_port",
        pcb_port_id: "port1",
        source_port_id: "source1",
        x: 0,
        y: 0,
        pcb_component_id: "comp1",
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "port2",
        source_port_id: "source2",
        x: 4,
        y: 4,
        pcb_component_id: "comp2",
        layers: ["bottom"],
      },
      {
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: ["source1", "source2"],
        connected_source_net_ids: [],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "pcb_trace1",
        route: [
          {
            route_type: "wire",
            x: 0,
            y: 0,
            start_pcb_port_id: "port1",
            width: 0.1,
            layer: "top",
          },
          {
            route_type: "via",
            x: 2,
            y: 2,
            from_layer: "top",
            to_layer: "bottom",
          },
          {
            route_type: "wire",
            x: 4,
            y: 4,
            end_pcb_port_id: "port2",
            layer: "bottom",
            width: 0.1,
          },
        ],
      },
    ]

    const errors = checkPcbPortPeerConnectivity(circuitJson)
    expect(errors).toHaveLength(0) // Trace with via should still connect the ports
  })

  test("should handle empty soup", () => {
    expect(checkPcbPortPeerConnectivity([])).toEqual([])
  })

  test("should handle missing peer PCB ports gracefully", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_port",
        pcb_port_id: "port1",
        source_port_id: "source1",
        x: 0,
        y: 0,
        pcb_component_id: "comp1",
        layers: ["top"],
      },
      // Missing port2 PCB port
      {
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: ["source1", "source2"], // source2 has no corresponding PCB port
        connected_source_net_ids: [],
      },
    ]

    const errors = checkPcbPortPeerConnectivity(circuitJson)
    expect(errors).toHaveLength(0) // Should skip check when peer PCB ports don't exist
  })
})
