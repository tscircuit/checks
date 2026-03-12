import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

test("SMT pads on different layers at the same position should NOT be flagged as overlapping", () => {
  const soup: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4" as const,
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_top",
      shape: "rect",
      x: 0.5,
      y: 0,
      width: 2,
      height: 2,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_bottom",
      shape: "rect",
      x: -0.5,
      y: 0,
      width: 2,
      height: 2,
      layer: "bottom",
    },
  ]

  const errors = checkPcbComponentOverlap(soup)
  expect(errors).toHaveLength(0)

  soup.push(...errors)
  expect(
    convertCircuitJsonToPcbSvg(soup, { shouldDrawErrors: true }),
  ).toMatchSvgSnapshot(import.meta.path)
})