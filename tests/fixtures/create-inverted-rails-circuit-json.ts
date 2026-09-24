import type { AnyCircuitElement, SchematicPort } from "circuit-json"

export const createInvertedRailsCircuitJson = ({
  orientation = "inverted",
  positiveSupply = true,
  ambiguousSupply = false,
}: {
  orientation?: "inverted" | "correct" | "horizontal"
  positiveSupply?: boolean
  ambiguousSupply?: boolean
} = {}): AnyCircuitElement[] => {
  const positivePort: Pick<SchematicPort, "center" | "facing_direction"> =
    orientation === "horizontal"
      ? { center: { x: -1, y: 0 }, facing_direction: "left" }
      : orientation === "correct"
        ? { center: { x: 0, y: 1 }, facing_direction: "up" }
        : { center: { x: 0, y: -1 }, facing_direction: "down" }
  const groundPort: Pick<SchematicPort, "center" | "facing_direction"> =
    orientation === "horizontal"
      ? { center: { x: 1, y: 0 }, facing_direction: "right" }
      : orientation === "correct"
        ? { center: { x: 0, y: -1 }, facing_direction: "down" }
        : { center: { x: 0, y: 1 }, facing_direction: "up" }

  return [
    {
      type: "source_component",
      source_component_id: "source_component_1",
      name: "C1",
      ftype: "simple_capacitor",
      capacitance: 100e-9,
    },
    {
      type: "schematic_component",
      schematic_component_id: "schematic_component_1",
      source_component_id: "source_component_1",
      schematic_sheet_id: "schematic_sheet_1",
      subcircuit_id: "subcircuit_1",
      center: { x: 0, y: 0 },
      size: { width: 1, height: 1 },
      is_box_with_pins: false,
      symbol_name: "capacitor",
    },
    ...[positivePort, groundPort].flatMap(
      (port, index): AnyCircuitElement[] => [
        {
          type: "source_port",
          source_port_id: `source_port_${index + 1}`,
          source_component_id: "source_component_1",
          name: `pin${index + 1}`,
          pin_number: index + 1,
          port_hints: [`${index + 1}`],
        },
        {
          type: "schematic_port",
          schematic_port_id: `schematic_port_${index + 1}`,
          schematic_component_id: "schematic_component_1",
          source_port_id: `source_port_${index + 1}`,
          pin_number: index + 1,
          ...port,
        },
        {
          type: "source_trace",
          source_trace_id: `source_trace_${index + 1}`,
          connected_source_port_ids: [`source_port_${index + 1}`],
          connected_source_net_ids: [`source_net_${index + 1}`],
        },
      ],
    ),
    {
      type: "source_net",
      source_net_id: "source_net_1",
      name: "VCC",
      member_source_group_ids: [],
      is_power: true,
      is_positive_voltage_source: positiveSupply,
      is_ground: ambiguousSupply,
    },
    {
      type: "source_net",
      source_net_id: "source_net_2",
      name: "GND",
      member_source_group_ids: [],
      is_ground: true,
    },
  ]
}
