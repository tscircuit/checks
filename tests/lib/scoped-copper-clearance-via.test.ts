import { expect, test } from "bun:test"
import { checkScopedCopperClearance } from "../../index"
import { clearanceFixture } from "./scoped-clearance-fixture"

test("scoped copper rules measure via-pad copper and keep unnamed diagnostics readable", () => {
  const circuit = clearanceFixture().filter(
    (element) => element.type !== "pcb_trace",
  )
  circuit.push(
    {
      type: "pcb_via",
      pcb_via_id: "private_via_id",
      x: 0,
      y: 0,
      outer_diameter: 1,
      hole_diameter: 0.3,
      layers: ["top", "bottom"],
      source_net_id: "source_net_earth",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "private_pad_id",
      pcb_component_id: "unowned",
      shape: "circle",
      x: 3,
      y: 0,
      radius: 0.5,
      layer: "top",
    },
  )
  const errors = checkScopedCopperClearance(circuit)
  expect(errors).toHaveLength(1)
  expect(errors[0]!.actual_clearance).toBeCloseTo(2, 8)
  expect(errors[0]!.minimum_clearance).toBe(4.14)
  expect(errors[0]!.message).not.toContain("private_")
  expect(errors[0]!.message).not.toContain("unowned")
})
