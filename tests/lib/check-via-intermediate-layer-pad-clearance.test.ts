import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaPadClearance } from "lib/check-via-pad-clearance"

test("a through via conflicts with an unrelated pad on an intermediate layer", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
      thickness: 1.6,
      num_layers: 4,
      material: "fr4",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "inner_pad",
      shape: "circle",
      x: 0,
      y: 0,
      radius: 0.25,
      layer: "inner2",
    },
    {
      type: "pcb_via",
      pcb_via_id: "through_via",
      pcb_trace_id: "through_trace",
      x: 0,
      y: 0,
      hole_diameter: 0.25,
      outer_diameter: 0.5,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_via",
      pcb_via_id: "blind_via",
      pcb_trace_id: "blind_trace",
      x: 0,
      y: 0,
      hole_diameter: 0.25,
      outer_diameter: 0.5,
      layers: ["top", "inner1"],
    },
  ]

  const errors = checkViaPadClearance(circuitJson, {
    connMap: {
      areIdsConnected: (a: string, b: string) => a === b,
    } as any,
  })

  expect(errors).toHaveLength(1)
  expect(errors[0]?.pcb_pad_ids).toEqual(["through_via", "inner_pad"])
})
