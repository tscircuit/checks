import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbBoard, PcbVia } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkViaPadClearance } from "../../lib/check-via-pad-clearance"
import { checkViasInPads } from "../../lib/check-vias-in-pads"

test("reproduces clearance errors when the board allows via-in-pad", () => {
  const board: PcbBoard & { is_via_in_pad_allowed: boolean } = {
    type: "pcb_board",
    pcb_board_id: "board",
    center: { x: 0, y: 0 },
    width: 8,
    height: 8,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
    is_via_in_pad_allowed: true,
  }
  const vias: PcbVia[] = [
    { x: -0.75, y: -0.5 },
    { x: 0.75, y: -0.5 },
    { x: -0.75, y: 0.5 },
    { x: 0.75, y: 0.5 },
  ].map((position, index) => ({
    type: "pcb_via",
    pcb_via_id: `thermal_via_${index + 1}`,
    ...position,
    hole_diameter: 0.2,
    outer_diameter: 0.4,
    layers: ["top", "bottom"],
  }))
  const circuitJson: AnyCircuitElement[] = [
    board,
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "thermal_pad",
      shape: "rect",
      x: 0,
      y: 0,
      width: 3,
      height: 2,
      layer: "top",
    },
    ...vias,
  ]

  expect(checkViasInPads(circuitJson)).toEqual([])

  const clearanceErrors = checkViaPadClearance(circuitJson)
  expect(clearanceErrors).toHaveLength(4)
  expect(
    clearanceErrors.every((error) => error.pcb_pad_ids.includes("thermal_pad")),
  ).toBe(true)

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...clearanceErrors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
