import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbRoutingConstraints } from "../../lib/check-pcb-routing-constraints"

test("routing constraints use the declared mean rather than the range", () => {
  const input: AnyCircuitElement[] = [
    {
      type: "source_bus",
      source_bus_id: "bus_1",
      source_trace_ids: ["signal_0", "signal_1", "signal_2"],
      max_length_skew: 3,
      min_length: 0,
      length_skew_reference: "mean",
    },
    ...[10, 10, 14].flatMap((length, index): AnyCircuitElement[] => {
      const source_trace_id = `signal_${index}`
      const ports = [
        { source_port_id: `${source_trace_id}_start`, x: 0 },
        { source_port_id: `${source_trace_id}_end`, x: length },
      ]
      return [
        {
          type: "source_trace",
          source_trace_id,
          connected_source_port_ids: ports.map((port) => port.source_port_id),
          connected_source_net_ids: [],
        },
        ...ports.map((port) => ({
          type: "pcb_port" as const,
          ...port,
          pcb_port_id: `pcb_${port.source_port_id}`,
          pcb_component_id: "component_1",
          x: port.x,
          y: index,
          layers: ["top" as const],
        })),
        {
          type: "pcb_trace",
          pcb_trace_id: `trace_${index}`,
          source_trace_id,
          route: ports.map((port) => ({
            route_type: "wire" as const,
            x: port.x,
            y: index,
            layer: "top" as const,
            width: 0.1,
          })),
        },
      ]
    }),
  ]
  expect(checkPcbRoutingConstraints(input)).toEqual([])
  const rangeInput = structuredClone(input)
  const bus = rangeInput.find((element) => element.type === "source_bus")!
  delete bus.length_skew_reference
  expect(checkPcbRoutingConstraints(rangeInput)).toHaveLength(1)
})
