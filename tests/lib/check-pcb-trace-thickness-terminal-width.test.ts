import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { checkSourceTracesMatchPcbTraceThickness } from "lib/check-source-traces-match-pcb-trace-thickness"

function getCircuitJsonWithRoute(
  route: PcbTrace["route"],
): AnyCircuitElement[] {
  return [
    {
      type: "source_trace",
      source_trace_id: "source_trace_0",
      connected_source_port_ids: ["source_port_1", "source_port_2"],
      connected_source_net_ids: [],
      min_trace_thickness: 0.3,
      display_name: "PWR to VDD",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_0",
      source_trace_id: "source_trace_0",
      route,
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
  ]
}

test.each([0.1, 0.2, 0.4])(
  "reports an undersized segment regardless of terminal width %s",
  (terminalWidth) => {
    const circuitJson = getCircuitJsonWithRoute([
      {
        route_type: "wire",
        x: -10,
        y: 0,
        width: 0.2,
        layer: "top",
        start_pcb_port_id: "pcb_port_1",
      },
      {
        route_type: "wire",
        x: 10,
        y: 0,
        width: terminalWidth,
        layer: "top",
        end_pcb_port_id: "pcb_port_2",
      },
    ])

    const warnings = checkSourceTracesMatchPcbTraceThickness(circuitJson)

    expect(warnings).toHaveLength(1)
    expect(warnings[0].pcb_trace_id).toBe("pcb_trace_0")
    expect(warnings[0].center).toEqual({ x: 0, y: 0 })
    expect(warnings[0].message).toContain("actual: 0.2mm")
  },
)

test("locates the narrowest segment when the terminal width is smaller", () => {
  const circuitJson = getCircuitJsonWithRoute([
    {
      route_type: "wire",
      x: -10,
      y: 0,
      width: 0.2,
      layer: "top",
      start_pcb_port_id: "pcb_port_1",
    },
    { route_type: "wire", x: 0, y: 0, width: 0.15, layer: "top" },
    {
      route_type: "wire",
      x: 10,
      y: 0,
      width: 0.1,
      layer: "top",
      end_pcb_port_id: "pcb_port_2",
    },
  ])

  const warnings = checkSourceTracesMatchPcbTraceThickness(circuitJson)

  expect(warnings).toHaveLength(1)
  expect(warnings[0].center).toEqual({ x: 5, y: 0 })
  expect(warnings[0].message).toContain("actual: 0.15mm")
})

test("does not treat a narrow terminal width as an undersized segment", () => {
  const circuitJson = getCircuitJsonWithRoute([
    {
      route_type: "wire",
      x: -10,
      y: 0,
      width: 0.3,
      layer: "top",
      start_pcb_port_id: "pcb_port_1",
    },
    {
      route_type: "wire",
      x: 10,
      y: 0,
      width: 0.1,
      layer: "top",
      end_pcb_port_id: "pcb_port_2",
    },
  ])

  expect(checkSourceTracesMatchPcbTraceThickness(circuitJson)).toHaveLength(0)
})
