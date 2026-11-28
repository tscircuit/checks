import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaHoleClearance, runAllChecks } from "../../index"

test("repro tscircuit/checks#562: a via that overlaps a non-plated hole is reported as a collision", async () => {
  // Reproduction circuit from issue #562:
  // <board width="10mm" height="6mm">
  //   <hole name="H1" diameter="2mm" pcbX={0} pcbY={0} />
  //   <via
  //     name="V1"
  //     pcbX={0.9}
  //     pcbY={0}
  //     holeDiameter="0.3mm"
  //     outerDiameter="0.6mm"
  //     fromLayer="top"
  //     toLayer="bottom"
  //   />
  // </board>

  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board_1",
      center: { x: 0, y: 0 },
      width: 10,
      height: 6,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "pcb_hole_H1",
      x: 0,
      y: 0,
      hole_shape: "circle",
      hole_diameter: 2,
    },
    {
      type: "pcb_via",
      pcb_via_id: "pcb_via_V1",
      x: 0.9,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      from_layer: "top",
      to_layer: "bottom",
      layers: ["top", "bottom"],
    },
  ]

  const clearanceErrors = checkViaHoleClearance(circuitJson)
  expect(clearanceErrors).toHaveLength(1)
  expect(clearanceErrors[0]!.type).toBe("pcb_placement_error")
  expect(clearanceErrors[0]!.error_type).toBe("pcb_placement_error")
  expect(clearanceErrors[0]!.message).toContain("overlaps with pcb_hole")
  expect(clearanceErrors[0]!.message).toContain("(accidental contact)")
  expect(clearanceErrors[0]!.actual_clearance).toBeLessThanOrEqual(0)

  // runAllChecks should also surface the collision error
  const allErrors = await runAllChecks(circuitJson)
  const matchingErrors = allErrors.filter(
    (err) =>
      err.type === "pcb_placement_error" &&
      err.pcb_placement_error_id ===
        "via_hole_clearance_pcb_via_V1_pcb_hole_H1",
  )
  expect(matchingErrors).toHaveLength(1)
})
