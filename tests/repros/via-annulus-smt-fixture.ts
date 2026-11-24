import type { AnyCircuitElement, LayerRef, PcbTrace } from "circuit-json"
import { checkEachPcbPortConnectedToPcbTraces } from "../../lib/check-each-pcb-port-connected-to-pcb-trace"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"

// J_LCD.P14 on the AM4378 handheld, translated to the origin. The pad ends
// at x=0.75. The 0.35 mm via reaches x=0.731, with no top-layer wire stub.
export function lcdEscape(
  viaX = 0.906,
  layers: LayerRef[] = ["top", "bottom"],
): AnyCircuitElement[] {
  const wire = (x: number, layer: LayerRef) => ({
    route_type: "wire" as const,
    x,
    y: -0.067,
    layer,
    width: 0.1,
  })
  const trace = (id: string, route: PcbTrace["route"]): PcbTrace => ({
    type: "pcb_trace",
    pcb_trace_id: id,
    source_trace_id: "source_trace",
    route,
  })
  return [
    {
      type: "pcb_board",
      pcb_board_id: "board",
      center: { x: 0.5, y: 0 },
      width: 3,
      height: 1.3,
      num_layers: 4,
      thickness: 1.6,
      material: "fr4",
    },
    {
      type: "source_component",
      source_component_id: "connector",
      name: "J_LCD",
      ftype: "simple_chip",
    },
    {
      type: "source_port",
      source_component_id: "connector",
      source_port_id: "pin",
      name: "P14",
      port_hints: ["14"],
    },
    {
      type: "source_net",
      source_net_id: "net",
      name: "LCD_DE",
      member_source_group_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace",
      display_name: "LCD_DE",
      connected_source_port_ids: ["pin"],
      connected_source_net_ids: ["net"],
    },
    {
      type: "pcb_port",
      pcb_component_id: "connector_pcb",
      pcb_port_id: "port",
      source_port_id: "pin",
      x: 0,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad",
      pcb_port_id: "port",
      pcb_component_id: "connector_pcb",
      shape: "rect",
      x: 0,
      y: 0,
      width: 1.5,
      height: 0.3,
      layer: "top",
    },
    trace("escape_via", [
      wire(viaX, layers[0]!),
      {
        route_type: "via",
        x: viaX,
        y: -0.067,
        from_layer: layers[0]!,
        to_layer: "bottom",
        outer_diameter: 0.35,
        hole_diameter: 0.15,
      },
      wire(viaX, "bottom"),
    ]),
    {
      type: "pcb_via",
      pcb_via_id: "via",
      pcb_trace_id: "escape_via",
      x: viaX,
      y: -0.067,
      outer_diameter: 0.35,
      hole_diameter: 0.15,
      layers,
    },
    trace("escape_wire", [wire(viaX, "bottom"), wire(1.65, "bottom")]),
  ]
}

export function checkEscape(circuit: AnyCircuitElement[]) {
  return [
    ...checkEachPcbPortConnectedToPcbTraces(circuit),
    ...checkTracesAreContiguous(circuit),
  ]
}
