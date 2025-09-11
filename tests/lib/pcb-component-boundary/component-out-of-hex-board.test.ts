import { test, expect } from "bun:test"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import hexBoardJson from "tests/assets/component-out-of-hex-board-shape.json"

test("hex board: component inside/outside", () => {
  const circuitJson = hexBoardJson as AnyCircuitElement[]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)
  // R1 is outside
  expect(errors.length).toBe(1)
  expect(errors[0].pcb_component_id).toBe("pcb_component_3")
  expect(errors[0].message).toMatch(/extends outside board boundaries/)
  if (errors.length > 0) {
    circuitJson.push({
      type: "pcb_silkscreen_text",
      pcb_silkscreen_text_id: "pcb_silkscreen_text_3",
      anchor_position: errors[0].component_center,
      anchor_alignment: "center",
      font: "tscircuit2024",
      font_size: 0.4,
      layer: "top",
      text: "component outside",
      pcb_component_id: "pcb_component_3",
    })
  }
  // Snapshot SVG for visual verification
  expect(convertCircuitJsonToPcbSvg(circuitJson)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
