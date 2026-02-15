import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkHangingTraces } from "lib/check-hanging-traces/check-hanging-traces"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"

describe("checkHangingTraces", () => {
  test("does not report traces that connect pcb ports", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_port",
        pcb_port_id: "p1",
        source_port_id: "s1",
        x: 0,
        y: 0,
        pcb_component_id: "c1",
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "p2",
        source_port_id: "s2",
        x: 10,
        y: 0,
        pcb_component_id: "c1",
        layers: ["top"],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "t1",
        route: [
          {
            route_type: "wire",
            x: 0,
            y: 0,
            width: 0.1,
            layer: "top",
            start_pcb_port_id: "p1",
          },
          {
            route_type: "wire",
            x: 10,
            y: 0,
            width: 0.1,
            layer: "top",
            end_pcb_port_id: "p2",
          },
        ],
      },
    ]

    expect(checkHangingTraces(circuitJson)).toHaveLength(0)
  })

  test("reports trace endpoints that are not connected to pcb ports", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_port",
        pcb_port_id: "p1",
        source_port_id: "s1",
        x: 0,
        y: 0,
        pcb_component_id: "c1",
        layers: ["top"],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "t1",
        route: [
          {
            route_type: "wire",
            x: 0,
            y: 0,
            width: 0.1,
            layer: "top",
            start_pcb_port_id: "p1",
          },
          { route_type: "wire", x: 5, y: 0, width: 0.1, layer: "top" },
        ],
      },
    ]

    const errors = checkHangingTraces(circuitJson)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("hanging endpoint")
    expect(errors[0].center).toEqual({ x: 5, y: 0 })
  })

  test("reports endpoints that terminate along another trace", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_port",
        pcb_port_id: "p1",
        source_port_id: "s1",
        x: 0,
        y: 0,
        pcb_component_id: "c1",
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "p2",
        source_port_id: "s2",
        x: 10,
        y: 0,
        pcb_component_id: "c1",
        layers: ["top"],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "main",
        route: [
          {
            route_type: "wire",
            x: 0,
            y: 0,
            width: 0.1,
            layer: "top",
            start_pcb_port_id: "p1",
          },
          {
            route_type: "wire",
            x: 10,
            y: 0,
            width: 0.1,
            layer: "top",
            end_pcb_port_id: "p2",
          },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "branch",
        route: [
          { route_type: "wire", x: 5, y: 0, width: 0.1, layer: "top" },
          { route_type: "wire", x: 5, y: 3, width: 0.1, layer: "top" },
        ],
      },
    ]

    const errors = checkHangingTraces(circuitJson)
    expect(errors).toHaveLength(2)
    expect(errors[0].pcb_trace_id).toBe("branch")
    expect(errors[0].message).toContain("ends along trace")
    expect(errors[0].center).toEqual({ x: 5, y: 0 })
    expect(errors[1].message).toContain("hanging endpoint")
    expect(errors[1].center).toEqual({ x: 5, y: 3 })

    circuitJson.push(...errors)

    expect(
      convertCircuitJsonToPcbSvg(circuitJson, { shouldDrawErrors: true }),
    ).toMatchSvgSnapshot(import.meta.path)
  })
})
