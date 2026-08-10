import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaPadClearance } from "../../lib/check-via-pad-clearance"

test("checkViaPadClearance reports an escape via too close to an unrelated fine-pitch pad", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "source_pad",
      shape: "rect",
      x: 0,
      y: 0,
      width: 0.65,
      height: 0.15,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "neighbor_pad",
      shape: "rect",
      x: 0,
      y: 0.35,
      width: 0.65,
      height: 0.15,
      layer: "top",
    },
    {
      type: "pcb_via",
      pcb_via_id: "escape_via",
      x: -0.45,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      layers: ["top", "inner1"],
    },
  ]

  const errors = checkViaPadClearance(circuitJson, {
    connMap: {
      areIdsConnected: (a: string, b: string) =>
        [a, b].includes("escape_via") && [a, b].includes("source_pad"),
    } as any,
  })

  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_pad_ids).toEqual(["escape_via", "neighbor_pad"])
  expect(errors[0].minimum_clearance).toBe(0.1)
  expect(errors[0].actual_clearance).toBeCloseTo(0.002076, 5)
})
