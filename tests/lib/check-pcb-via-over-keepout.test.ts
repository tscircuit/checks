import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbCopperOverKeepout } from "lib/check-pcb-copper-over-keepout"

test("reports a via inside a circular keepout on a shared layer", () => {
  const circleKeepoutCircuitJson = [
    {
      type: "pcb_board",
      pcb_board_id: "pcb_board_1",
      center: { x: 1, y: 1 },
      width: 5,
      height: 5,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
    },
    {
      type: "pcb_via",
      pcb_via_id: "pcb_via_1",
      x: 1,
      y: 1,
      hole_diameter: 0.2,
      outer_diameter: 0.5,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_keepout",
      pcb_keepout_id: "pcb_keepout_circle",
      shape: "circle",
      center: { x: 1, y: 1 },
      radius: 1,
      layers: ["bottom"],
    },
    {
      type: "pcb_silkscreen_text",
      pcb_silkscreen_text_id: "pcb_silkscreen_text_via",
      pcb_component_id: "",
      anchor_position: { x: 1, y: -0.4 },
      anchor_alignment: "center",
      font: "tscircuit2024",
      font_size: 0.3,
      layer: "top",
      text: "VIA ERROR",
    },
  ] as AnyCircuitElement[]
  const errors = checkPcbCopperOverKeepout(circleKeepoutCircuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0]?.pcb_placement_error_id).toBe(
    "copper_over_keepout_pcb_via_1_pcb_keepout_circle",
  )
  expect(
    convertCircuitJsonToPcbSvg([...circleKeepoutCircuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path, "via-over-circle-keepout")
})
