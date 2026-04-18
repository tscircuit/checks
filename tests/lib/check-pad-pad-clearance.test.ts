import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPadPadClearance } from "../../lib/check-pad-pad-clearance"

test("checkPadPadClearance reports pads closer than 0.2mm", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      shape: "rect",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad2",
      shape: "rect",
      x: 1.05,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
  ]

  const errors = checkPadPadClearance(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0].type).toBe("pcb_pad_pad_clearance_error")
  expect(errors[0].pcb_pad_ids).toEqual(["pad1", "pad2"])
  expect(errors[0].minimum_clearance).toBe(0.1)
  expect(errors[0].actual_clearance).toBeCloseTo(0.05, 10)
})
