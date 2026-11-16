import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"
import { makeBoard, makeVia } from "./fixtures"

test("vias without board ownership fall back to the first board's rules", () => {
  const circuitJson: AnyCircuitElement[] = [
    makeBoard({ min_via_pad_diameter: 0.4 }),
    makeBoard({
      pcb_board_id: "pcb_board_2",
      min_via_pad_diameter: 2,
    }),
    makeVia(0.3, 0.7),
  ]
  expect(checkViaAndHoleAnnularRing(circuitJson)).toEqual([])
})
