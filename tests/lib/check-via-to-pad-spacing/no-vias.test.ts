import { expect, test } from "bun:test"
import { checkViaToPadSpacing } from "lib/check-via-to-pad-spacing"
import type { AnyCircuitElement } from "circuit-json"

test("returns empty array when no vias", () => {
  const soup: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      shape: "rect",
      x: 0,
      y: 0,
      width: 0.4,
      height: 0.3,
      layer: "top",
    },
  ]
  expect(checkViaToPadSpacing(soup)).toHaveLength(0)
})
