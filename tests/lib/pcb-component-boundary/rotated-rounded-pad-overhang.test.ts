import { expect, test } from "bun:test"
import {
  pcb_board,
  pcb_component,
  pcb_smtpad,
  type AnyCircuitElement,
} from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"

test("a rotated rounded pad crossing the board edge reports its overhang", () => {
  const center = { x: 4.94, y: 0.13 }
  const elements: AnyCircuitElement[] = [
    pcb_board.parse({
      type: "pcb_board",
      pcb_board_id: "pcb_board_0",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
      num_layers: 2,
    }),
    pcb_component.parse({
      type: "pcb_component",
      pcb_component_id: "pcb_component_0",
      source_component_id: "source_component_0",
      center,
      width: 0.63,
      height: 1.31,
      rotation: 0,
      layer: "top",
    }),
    pcb_smtpad.parse({
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_0",
      pcb_component_id: "pcb_component_0",
      shape: "rotated_rect",
      ...center,
      width: 0.63,
      height: 1.31,
      ccw_rotation: 136.5,
      corner_radius: 0.1575,
      layer: "top",
    }),
  ]
  const diagnostics = checkPcbComponentsOutOfBoard(elements)
  expect(diagnostics).toHaveLength(1)
  expect(diagnostics[0]?.type).toBe("pcb_component_outside_board_error")
  expect(diagnostics[0]?.message).toBe(
    "Component unnamed component extends outside board boundaries by 0.55mm. Try moving it 0.55mm left to fit within the board edge.",
  )
  expect(
    convertCircuitJsonToPcbSvg([...elements, ...diagnostics], {
      shouldDrawErrors: true,
      viewport: { minX: 3, minY: -2, maxX: 7, maxY: 2 },
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
