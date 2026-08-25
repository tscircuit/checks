import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbBoard, PcbComponent } from "circuit-json"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"

test("checks components against a detailed board outline efficiently", () => {
  const boardRadius = 50
  const boardOutlinePointCount = 2_400
  const componentCount = 74
  const maximumCheckDurationMs = 1_000
  const board: PcbBoard = {
    type: "pcb_board",
    pcb_board_id: "detailed_board",
    center: { x: 0, y: 0 },
    width: boardRadius * 2,
    height: boardRadius * 2,
    num_layers: 2,
    thickness: 1.6,
    material: "fr4",
    outline: Array.from({ length: boardOutlinePointCount }, (_, index) => {
      const angleRadians = (index / boardOutlinePointCount) * Math.PI * 2
      return {
        x: Math.cos(angleRadians) * boardRadius,
        y: Math.sin(angleRadians) * boardRadius,
      }
    }),
  }
  const components: PcbComponent[] = Array.from(
    { length: componentCount },
    (_, index) => ({
      type: "pcb_component",
      pcb_component_id: `pcb_component_${index}`,
      source_component_id: `source_component_${index}`,
      center: {
        x: (index % 10) - 5,
        y: Math.floor(index / 10) - 4,
      },
      width: 1,
      height: 1,
      layer: "top",
      rotation: 0,
      obstructs_within_bounds: true,
    }),
  )
  const circuitJson: AnyCircuitElement[] = [board, ...components]

  const start = performance.now()
  const errors = checkPcbComponentsOutOfBoard(circuitJson)
  const durationMs = performance.now() - start

  expect(errors).toEqual([])
  expect(durationMs).toBeLessThan(maximumCheckDurationMs)
})
