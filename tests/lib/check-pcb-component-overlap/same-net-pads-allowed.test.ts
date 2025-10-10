import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

test("overlapping SMT pads on same net should not produce errors", () => {
  const soup: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 20,
      height: 20,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4" as const,
    },
    {
      type: "pcb_port",
      pcb_port_id: "port1",
      source_port_id: "source1",
      pcb_component_id: "comp1",
      layers: ["top"],
      x: 0,
      y: 0,
    },
    {
      type: "pcb_port",
      pcb_port_id: "port2",
      source_port_id: "source2",
      pcb_component_id: "comp2",
      layers: ["top"],
      x: 1,
      y: 1,
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      pcb_port_id: "port1",
      shape: "rect",
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad2",
      pcb_port_id: "port2",
      shape: "rect",
      x: 1,
      y: 1,
      width: 2,
      height: 2,
      layer: "top",
    },
    {
      type: "source_trace",
      source_trace_id: "strace1",
      connected_source_port_ids: ["source1", "source2"],
      connected_source_net_ids: [],
    },
  ]

  const errors = checkPcbComponentOverlap(soup)

  // No errors should be found for same-net pads
  expect(errors.length).toBe(0)

  // Add annotation below the pads to show this is allowed
  soup.push({
    type: "pcb_silkscreen_text",
    pcb_silkscreen_text_id: "info_indicator_1",
    pcb_component_id: "",
    anchor_position: { x: 0.5, y: -1.5 },
    anchor_alignment: "center",
    font: "tscircuit2024",
    font_size: 0.7,
    layer: "top",
    text: "✓ SAME NET OK",
  })

  // Create visual snapshot showing pads can overlap on same net
  expect(
    convertCircuitJsonToPcbSvg(soup, { shouldDrawErrors: true }),
  ).toMatchSvgSnapshot(import.meta.path)
})
