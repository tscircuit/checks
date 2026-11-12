import type { AnyCircuitElement } from "circuit-json"

export function createNetLabelCollisions({
  sheet = "sheet_a",
  corrected = false,
}: { sheet?: string; corrected?: boolean } = {}): AnyCircuitElement[] {
  return [0, 1, 2].flatMap((i): AnyCircuitElement[] => {
    const x = i * (corrected ? 5 : 3)
    const key = `${sheet}_${i}`
    return [
      {
        type: "source_component",
        source_component_id: `source_component_${key}`,
        name: `U${i + 1}`,
        ftype: "simple_chip",
      },
      {
        type: "schematic_component",
        schematic_component_id: `schematic_component_${key}`,
        source_component_id: `source_component_${key}`,
        schematic_sheet_id: sheet,
        subcircuit_id: `subcircuit_${sheet}`,
        center: { x, y: 0 },
        size: { width: 1, height: 1 },
        is_box_with_pins: true,
      },
      {
        type: "source_port",
        source_port_id: `source_port_${key}`,
        source_component_id: `source_component_${key}`,
        name: "OUT",
        pin_number: 1,
      },
      {
        type: "schematic_port",
        schematic_port_id: `schematic_port_${key}`,
        source_port_id: `source_port_${key}`,
        schematic_component_id: `schematic_component_${key}`,
        schematic_sheet_id: sheet,
        center: { x: x + 0.7, y: 0 },
        pin_number: 1,
        facing_direction: "right",
      },
      {
        type: "source_net",
        source_net_id: `source_net_${key}`,
        name: `SIGNAL_${i}`,
        member_source_group_ids: [],
      },
      {
        type: "source_trace",
        source_trace_id: `source_trace_${key}`,
        connected_source_port_ids: [`source_port_${key}`],
        connected_source_net_ids: [`source_net_${key}`],
      },
      {
        type: "schematic_net_label",
        schematic_net_label_id: `schematic_net_label_${key}`,
        source_net_id: `source_net_${key}`,
        schematic_sheet_id: sheet,
        center: { x: x + 1.8, y: 0 },
        anchor_position: { x: x + 0.7, y: 0 },
        anchor_side: "left",
        text: `SIGNAL_${i}`,
      },
    ]
  })
}
