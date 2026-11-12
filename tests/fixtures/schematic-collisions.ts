import type { AnyCircuitElement } from "circuit-json"

export function createSchematicBoxes({
  positions = [0, 0.4, 0.8],
  sheet = "sheet_a",
}: { positions?: number[]; sheet?: string } = {}): AnyCircuitElement[] {
  return positions.flatMap((x, i): AnyCircuitElement[] => [
    {
      type: "source_component",
      source_component_id: `source_component_${sheet}_${i}`,
      name: `U${i + 1}`,
      ftype: "simple_chip",
    },
    {
      type: "schematic_component",
      schematic_component_id: `schematic_component_${sheet}_${i}`,
      source_component_id: `source_component_${sheet}_${i}`,
      schematic_sheet_id: sheet,
      subcircuit_id: `subcircuit_${sheet}`,
      center: { x, y: 0 },
      size: { width: 2, height: 2 },
      is_box_with_pins: true,
    },
  ])
}

export function createTextCollision({
  kind,
  corrected = false,
}: {
  kind: "component" | "text" | "trace"
  corrected?: boolean
}): AnyCircuitElement[] {
  const json = createSchematicBoxes({
    positions: kind === "component" ? [0, 4] : [-4, 4],
  })
  for (const [i, x] of [-3, 3].entries()) {
    json.push(
      {
        type: "source_port",
        source_port_id: `source_port_${i}`,
        source_component_id: `source_component_sheet_a_${i}`,
        name: "SIGNAL",
        pin_number: 1,
      },
      {
        type: "schematic_port",
        schematic_port_id: `schematic_port_${i}`,
        source_port_id: `source_port_${i}`,
        schematic_component_id: `schematic_component_sheet_a_${i}`,
        schematic_sheet_id: "sheet_a",
        center: { x: kind === "component" && i === 0 ? 1 : x, y: 0 },
        facing_direction: i === 0 ? "right" : "left",
        pin_number: 1,
      },
    )
  }
  json.push(
    {
      type: "source_trace",
      source_trace_id: "source_trace_signal",
      connected_source_port_ids: ["source_port_0", "source_port_1"],
      connected_source_net_ids: [],
    },
    {
      type: "schematic_text",
      schematic_text_id: "schematic_text_note",
      schematic_sheet_id: "sheet_a",
      source_trace_id: kind === "text" ? "source_trace_signal" : undefined,
      text: "SIGNAL",
      font_size: 0.3,
      position: { x: 0, y: corrected ? 5 : 0 },
      rotation: 0,
      anchor: "center",
      color: "black",
    },
  )
  if (kind === "trace")
    json.push({
      type: "schematic_trace",
      schematic_trace_id: "schematic_trace_signal",
      source_trace_id: "source_trace_signal",
      schematic_sheet_id: "sheet_a",
      edges: [{ from: { x: -3, y: 0 }, to: { x: 3, y: 0 } }],
      junctions: [],
    })
  if (kind === "text")
    json.push({
      type: "schematic_text",
      schematic_text_id: "schematic_text_other",
      schematic_sheet_id: "sheet_a",
      text: "OTHER",
      font_size: 0.3,
      position: { x: 0.2, y: 0 },
      rotation: 0,
      anchor: "center",
      color: "black",
    })
  return json
}
