import { expect, test } from "bun:test"
import { pcb_board, type AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkViaPadClearance, runAllRoutingChecks } from "../../index"

function boardWithGap(
  viaToPad?: number,
  padToPad?: number,
): AnyCircuitElement[] {
  return [
    pcb_board.parse({
      type: "pcb_board",
      pcb_board_id: "board",
      center: { x: 0.3, y: 0 },
      width: 2.5,
      height: 1.5,
      min_via_edge_to_pad_edge_clearance: viaToPad,
      min_pad_edge_to_pad_edge_clearance: padToPad,
    }),
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad",
      shape: "rect",
      layer: "top",
      x: 0,
      y: 0,
      width: 0.6,
      height: 0.5,
    },
    {
      type: "pcb_via",
      pcb_via_id: "via",
      layers: ["top", "bottom"],
      x: 0.64,
      y: 0,
      outer_diameter: 0.4,
      hole_diameter: 0.2,
    },
  ]
}

test("routing checks report a 0.14 mm via-to-pad gap against the board's 0.20 mm minimum", async () => {
  const board = boardWithGap(0.2, 0.1)
  const errors = (await runAllRoutingChecks(board)).filter(
    (error) => error.type === "pcb_pad_pad_clearance_error",
  )
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_pad_ids).toEqual(["via", "pad"])
  expect(errors[0].actual_clearance).toBeCloseTo(0.14)
  expect(errors[0].minimum_clearance).toBe(0.2)
  expect(
    convertCircuitJsonToPcbSvg([...board, ...errors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})

test("a smaller via-to-pad rule takes precedence over a larger pad-to-pad rule", () => {
  expect(checkViaPadClearance(boardWithGap(0.1, 0.2))).toHaveLength(0)
  expect(checkViaPadClearance(boardWithGap(0, 0.2))).toHaveLength(0)
})

test("uses the generic pad rule when the via rule is omitted and honors an explicit override", () => {
  const errors = checkViaPadClearance(boardWithGap(undefined, 0.2))
  expect(errors.map((error) => error.minimum_clearance)).toEqual([0.2])
  expect(
    checkViaPadClearance(boardWithGap(0.2, 0.2), { minClearance: 0.1 }),
  ).toHaveLength(0)
})
