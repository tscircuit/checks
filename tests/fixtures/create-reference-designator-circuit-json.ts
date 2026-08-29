import type { AnyCircuitElement } from "circuit-json"

export const createReferenceDesignatorCircuitJson = ({
  name = "U1",
  displayName,
  texts = [],
}: {
  name?: string
  displayName?: string
  texts?: string[]
} = {}): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "source_component_1",
    name,
    display_name: displayName,
    ftype: "simple_chip",
  },
  {
    type: "schematic_component",
    schematic_component_id: "schematic_component_1",
    source_component_id: "source_component_1",
    center: { x: 0, y: 0 },
    size: { width: 2, height: 1 },
    is_box_with_pins: false,
  },
  ...texts.map(
    (text, index): AnyCircuitElement => ({
      type: "schematic_text",
      schematic_text_id: `schematic_text_${index + 1}`,
      schematic_component_id: "schematic_component_1",
      text,
      font_size: 0.18,
      position: { x: 0, y: index },
      rotation: 0,
      anchor: "left",
      color: "#006464",
    }),
  ),
]
