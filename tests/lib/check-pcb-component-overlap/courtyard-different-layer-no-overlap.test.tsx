import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement, PcbCourtyardRect } from "circuit-json"
import { checkCourtyardOverlap } from "lib/check-courtyard-overlap/checkCourtyardOverlap"

test("overlapping courtyards on different layers should not be flagged", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 20,
      height: 10,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4" as const,
    },
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "courtyard1",
      pcb_component_id: "component1",
      center: { x: 0, y: 0 },
      width: 4,
      height: 2,
      layer: "top",
    },
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "courtyard2",
      pcb_component_id: "component2",
      center: { x: 1, y: 0 },
      width: 4,
      height: 2,
      layer: "bottom",
    },
  ]

  const courtyards = circuitJson.filter(
    (el): el is PcbCourtyardRect => el.type === "pcb_courtyard_rect",
  )

  expect(courtyards).toHaveLength(2)
  expect(courtyards.map((el) => el.layer).sort()).toEqual(["bottom", "top"])

  const errors = checkCourtyardOverlap(circuitJson)
  expect(errors).toHaveLength(0)

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showCourtyards: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
