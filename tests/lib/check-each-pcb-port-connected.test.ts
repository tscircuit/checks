import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { checkEachPcbPortConnected } from "lib/check-each-pcb-port-connected"

describe("checkEachPcbPortConnected", () => {
  test("should not return error for intentionally unconnected ports", () => {
    const soup: AnyCircuitElement[] = [
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
        x: 1,
        y: 1,
        pcb_component_id: "comp2",
        layers: ["top"],
      },
      {
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: [],
        connected_source_net_ids: [],
      },
    ]
    const errors = checkEachPcbPortConnected(soup)
    expect(errors).toHaveLength(0)
  })
  test("should return null when all ports are connected", () => {
    const soup: AnyCircuitElement[] = [
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
        type: "pcb_trace",
        pcb_trace_id: "trace1",
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
            y: 0,
            layer: "top",
            width: 0.1,
          },
          {
            route_type: "wire",
            end_pcb_port_id: "port2",
            x: 4,
            y: 4,
            layer: "top",
            width: 0.1,
          },
        ],
      },
    ]
    expect(checkEachPcbPortConnected(soup)).toEqual([])
  })

  test.only("should return error when a port is not connected", () => {
    const soup: AnyCircuitElement[] = [
      {
        type: "pcb_port",
        pcb_port_id: "port1",
        source_port_id: "source1",
        x: 0,
        y: 0,
        pcb_component_id: "pcb1",
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "port2",
        source_port_id: "source2",
        x: 1,
        y: 1,
        pcb_component_id: "pcb2",
        layers: ["top"],
      },
      {
        type: "source_port",
        name: "source1",
        source_port_id: "source1",
        source_component_id: "comp1",
        pin_number: 1,
        port_hints: ["1"],
      },
      {
        type: "source_port",
        name: "source2",
        source_port_id: "source2",
        source_component_id: "comp2",
        pin_number: 2,
        port_hints: ["2"],
      },
      {
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: ["source1", "source2"],
        connected_source_net_ids: [],
      },
      {
        type: "source_component",
        ftype: "simple_resistor",
        source_component_id: "comp1",
        resistance: 1000,
        name: "comp1",
        supplier_part_numbers: {},
      },
      {
        type: "source_component",
        ftype: "simple_resistor",
        source_component_id: "comp2",
        resistance: 1000,
        name: "comp2",
        supplier_part_numbers: {},
      },
      {
        type: "pcb_component",
        source_component_id: "comp1",
        pcb_component_id: "pcb1",
        width: 1,
        height: 1,
        rotation: 0,
        layer: "top",
        center: {
          x: 0,
          y: 0,
        },
      },
      {
        type: "pcb_component",
        source_component_id: "comp2",
        pcb_component_id: "pcb2",
        width: 1,
        height: 1,
        rotation: 0,
        layer: "top",
        center: {
          x: 0,
          y: 0,
        },
      },
    ]
    const errors = checkEachPcbPortConnected(soup)
    expect(errors.map((e) => e.message).join("\n")).toContain(".comp1 > .1")
    expect(errors).toHaveLength(2)
  })

  test("should return errors for ports not connected by PCB traces", () => {
    const soup: AnyCircuitElement[] = [
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
        x: 0,
        y: 0,
        pcb_component_id: "comp2",
        layers: ["top"],
      },
      {
        type: "source_trace",
        source_trace_id: "trace1",
        connected_source_port_ids: ["source1", "source2"],
        connected_source_net_ids: ["net1", "net2"],
      },
    ]
    const errors = checkEachPcbPortConnected(soup)
    expect(errors).toHaveLength(2)
    expect(errors[0].message).toContain("port1")
    expect(errors[1].message).toContain("port2")
  })

  test("should handle empty soup", () => {
    expect(checkEachPcbPortConnected([])).toEqual([])
  })

  test("should automatically add start_pcb_port_id and end_pcb_port_id", () => {
    const soup: AnyCircuitElement[] = [
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
        type: "pcb_trace",
        pcb_trace_id: "trace1",
        route: [
          {
            route_type: "wire",
            x: 0,
            y: 0,
            width: 0.1,
            layer: "top",
          },
          {
            route_type: "wire",
            x: 4,
            y: 4,
            layer: "top",
            width: 0.1,
          },
        ],
      },
    ]
    expect(checkEachPcbPortConnected(soup)).toEqual([])

    // Check if start_pcb_port_id and end_pcb_port_id were added
    const updatedTrace = soup.find(
      (item) => item.type === "pcb_trace",
    ) as PcbTrace
    // @ts-ignore
    expect(updatedTrace.route[0].start_pcb_port_id).toBe("port1")
    // @ts-ignore
    expect(updatedTrace.route[1].end_pcb_port_id).toBe("port2")
  })
})
