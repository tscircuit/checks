import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import { containsCircuitJsonId } from "lib/util/get-readable-names"
import {
  firstBoard,
  secondBoard,
  componentOnSecondBoard,
  componentSource,
} from "../../fixtures/multi-board-component-containment"

test("component containment uses its own board regardless of board order", () => {
  for (const named of [true, false]) {
    for (const scenario of [
      {
        name: "valid-on-second-board",
        first: firstBoard,
        second: secondBoard,
        center: { x: 20, y: 0 },
        count: 0,
      },
      {
        name: "outside-second-board-inside-first",
        first: { ...firstBoard, width: 60 },
        second: secondBoard,
        center: { x: 26, y: 0 },
        count: 1,
      },
      {
        name: "outside-second-board-outline",
        first: { ...firstBoard, width: 60 },
        second: {
          ...secondBoard,
          outline: [
            { x: 15, y: -5 },
            { x: 25, y: -5 },
            { x: 25, y: 2 },
            { x: 22, y: 5 },
            { x: 15, y: 5 },
          ],
        },
        center: { x: 24, y: 4 },
        count: 1,
      },
    ]) {
      const component = { ...componentOnSecondBoard, center: scenario.center }
      const circuitJson: AnyCircuitElement[] = [
        scenario.first,
        scenario.second,
        component,
        {
          type: "pcb_smtpad",
          pcb_smtpad_id: "pad_b",
          pcb_component_id: component.pcb_component_id,
          shape: "rect",
          x: component.center.x,
          y: component.center.y,
          width: 2,
          height: 2,
          layer: "top",
        },
        ...(named ? [componentSource] : []),
      ]
      const original = structuredClone(circuitJson)
      const errors = checkPcbComponentsOutOfBoard(circuitJson)
      expect(errors).toHaveLength(scenario.count)
      expect(
        checkPcbComponentsOutOfBoard([
          scenario.second,
          scenario.first,
          ...circuitJson.slice(2),
        ]),
      ).toEqual(errors)
      expect(circuitJson).toEqual(original)
      for (const error of errors) {
        expect(error.pcb_board_id).toBe(secondBoard.pcb_board_id)
        expect(error.pcb_component_id).toBe(component.pcb_component_id)
        expect(error.message).toContain(named ? "U2" : "unnamed component")
        expect(containsCircuitJsonId(error.message)).toBe(false)
      }
      if (!named) continue
      const annotated: AnyCircuitElement[] = [
        ...circuitJson,
        ...errors.map((error) => ({ ...error, message: "U2 OUTSIDE BOARD B" })),
        {
          type: "pcb_note_text",
          pcb_note_text_id: "board_a_note",
          text: "BOARD A",
          anchor_position: {
            x: (scenario.first.width ?? 0) > 10 ? -12 : 0,
            y: 7,
          },
          anchor_alignment: "center",
          font: "tscircuit2024",
          font_size: 1,
          layer: "top",
        },
        {
          type: "pcb_note_text",
          pcb_note_text_id: "board_b_note",
          text: "BOARD B",
          anchor_position: { x: 20, y: 7 },
          anchor_alignment: "center",
          font: "tscircuit2024",
          font_size: 1,
          layer: "top",
        },
        {
          type: "pcb_note_text",
          pcb_note_text_id: "ownership_note",
          text: scenario.count
            ? "U2 IS OUTSIDE ITS OWN BOARD B"
            : "U2 BELONGS TO BOARD B: VALID",
          anchor_position: { x: 3, y: -7 },
          anchor_alignment: "center",
          font: "tscircuit2024",
          font_size: 1,
          layer: "top",
        },
      ]
      expect(
        convertCircuitJsonToPcbSvg(annotated, {
          shouldDrawErrors: true,
          showPcbNotes: true,
          width: 1200,
          height: 500,
          viewport: { minX: -32, maxX: 32, minY: -9, maxY: 9 },
        }),
      ).toMatchSvgSnapshot(import.meta.path, scenario.name)
    }
  }
})
