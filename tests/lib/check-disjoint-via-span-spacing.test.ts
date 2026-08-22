import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkDifferentNetViaSpacing } from "lib/check-different-net-via-spacing"
import { checkSameNetViaSpacing } from "lib/check-same-net-via-spacing"

test("nearby vias on disjoint physical spans do not require spacing", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
      thickness: 1.6,
      num_layers: 6,
      material: "fr4",
    },
    {
      type: "pcb_via",
      pcb_via_id: "upper_via",
      x: 0,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.5,
      layers: ["top", "inner1"],
    },
    {
      type: "pcb_via",
      pcb_via_id: "lower_via",
      x: 0.1,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.5,
      layers: ["inner2", "bottom"],
    },
  ]

  expect(
    checkDifferentNetViaSpacing(circuitJson, {
      connMap: { areIdsConnected: () => false } as any,
    }),
  ).toEqual([])
  expect(
    checkSameNetViaSpacing(circuitJson, {
      connMap: { areIdsConnected: () => true } as any,
    }),
  ).toEqual([])
})
