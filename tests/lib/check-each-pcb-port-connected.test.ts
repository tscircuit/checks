import type { AnySoupElement } from "@tscircuit/soup"
import { expect, test, describe } from "bun:test"
import { checkEachPcbPortConnected } from "lib/check-each-pcb-port-connected"

describe("checkEachPcbPortConnected", () => {
  test("should return null when all ports are connected", () => {
    const soup: AnySoupElement[] = [
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

  test("should return error when a port is not connected", () => {
    const soup: AnySoupElement[] = [
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
        type: "pcb_trace",
        pcb_trace_id: "trace1",
        route: [
          {
            x: 0,
            y: 0,
            width: 1,
            layer: "top",
            route_type: "wire",
            start_pcb_port_id: "port1",
            end_pcb_port_id: "somewhere",
          },
        ],
      },
    ]
    const errors = checkEachPcbPortConnected(soup)
    expect(errors).toHaveLength(1)
  })

  test("should return errors for ports not connected by PCB traces", () => {
    const soup: AnySoupElement[] = [
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
})
