import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkCourtyardOverlap } from "lib/check-courtyard-overlap/checkCourtyardOverlap"

const square = (centerX: number) => [
  { x: centerX - 1.5, y: -1.5 },
  { x: centerX + 1.5, y: -1.5 },
  { x: centerX + 1.5, y: 1.5 },
  { x: centerX - 1.5, y: 1.5 },
]

const makePolygonComponent = ({
  id,
  layer,
  x,
}: {
  id: string
  layer: "top" | "bottom"
  x: number
}): AnyCircuitElement[] =>
  [
    {
      type: "source_component",
      source_component_id: `source_${id}`,
      ftype: "simple_chip",
      name: id,
    },
    {
      type: "pcb_component",
      pcb_component_id: `component_${id}`,
      source_component_id: `source_${id}`,
      center: { x, y: 0 },
      width: 3,
      height: 3,
      layer,
      rotation: 0,
    },
    {
      type: "pcb_courtyard_polygon",
      pcb_courtyard_polygon_id: `courtyard_${id}`,
      pcb_component_id: `component_${id}`,
      points: square(x),
      layer,
      color: layer === "bottom" ? "#00BFFF" : "#FF00FF",
    },
  ] as AnyCircuitElement[]

test.failing(
  "checks same-layer polygon courtyards while allowing opposite layers",
  () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_board",
        pcb_board_id: "board",
        center: { x: 0, y: 0 },
        width: 14,
        height: 8,
        thickness: 1.6,
        num_layers: 2,
        material: "fr4",
      },
      ...makePolygonComponent({ id: "top_a", layer: "top", x: -1 }),
      ...makePolygonComponent({ id: "top_b", layer: "top", x: 1 }),
      ...makePolygonComponent({ id: "bottom", layer: "bottom", x: -1.2 }),
      {
        type: "pcb_note_text",
        pcb_note_text_id: "note_top",
        text: "Top polygons overlap: expected error",
        font: "tscircuit2024",
        font_size: 0.45,
        anchor_position: { x: 0, y: 2.8 },
        anchor_alignment: "center",
        layer: "top",
        color: "#FF00FF",
      },
      {
        type: "pcb_note_text",
        pcb_note_text_id: "note_bottom",
        text: "Bottom polygon (cyan): overlap allowed",
        font: "tscircuit2024",
        font_size: 0.45,
        anchor_position: { x: 0, y: -2.8 },
        anchor_alignment: "center",
        layer: "top",
        color: "#00BFFF",
      },
    ]

    const errors = checkCourtyardOverlap(circuitJson)

    expect(
      convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
        shouldDrawErrors: true,
        showCourtyards: true,
      }),
    ).toMatchSvgSnapshot(import.meta.path)

    expect(errors).toHaveLength(1)
    expect(errors[0].pcb_component_ids).toEqual([
      "component_top_a",
      "component_top_b",
    ])
  },
)
