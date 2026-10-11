import { traceWidthFixture } from "./trace-width"

/** Two explicitly owned routes sharing a port (and therefore one net). */
export function sourceAttributionFixture(required: number, actual = required) {
  const circuit = traceWidthFixture([actual, actual])
  const source = circuit.find((e) => e.type === "source_trace")!
  source.min_trace_thickness = required
  source.display_name = required === 0.5 ? "USB_GND_1" : "TEC_INPUT_HOT_LOOP"
  circuit.push(
    {
      type: "source_trace",
      source_trace_id: "source_trace_1",
      connected_source_port_ids: ["source_port_1", "source_port_2"],
      connected_source_net_ids: [],
      min_trace_thickness: 0.2,
      display_name:
        required === 0.5 ? "INPUT_DVDT_LOCAL_GROUND" : "TEC_CONTROLLER_VIN",
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_2",
      source_port_id: "source_port_2",
      pcb_component_id: "pcb_component_2",
      x: 10,
      y: 10,
      layers: ["top"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_1",
      source_trace_id: "source_trace_1",
      route: [
        {
          route_type: "wire",
          x: 10,
          y: 0,
          width: 0.2,
          layer: "top",
          start_pcb_port_id: "pcb_port_1",
        },
        {
          route_type: "wire",
          x: 10,
          y: 10,
          width: 0.2,
          layer: "top",
          end_pcb_port_id: "pcb_port_2",
        },
      ],
    },
  )
  return circuit
}
