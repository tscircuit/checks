import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbCopperOverKeepout } from "lib/check-pcb-copper-over-keepout"
import { runAllPlacementChecks } from "lib/run-all-checks"

const circuitJson = [
  {
    type: "source_component",
    source_component_id: "source_component_c14",
    ftype: "simple_capacitor",
    name: "C14",
    capacitance: 1e-12,
    supplier_part_numbers: {},
  },
  {
    type: "source_component",
    source_component_id: "source_component_ant1",
    ftype: "simple_chip",
    name: "ANT1",
    supplier_part_numbers: {},
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_component_c14",
    source_component_id: "source_component_c14",
    center: { x: 0, y: 0 },
    width: 2,
    height: 1,
    layer: "top",
    rotation: 0,
    obstructs_within_bounds: false,
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_component_ant1",
    source_component_id: "source_component_ant1",
    center: { x: 2, y: 0 },
    width: 1,
    height: 1,
    layer: "top",
    rotation: 0,
    obstructs_within_bounds: false,
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_c14_1",
    pcb_component_id: "pcb_component_c14",
    shape: "rect",
    x: -0.25,
    y: 0,
    width: 0.6,
    height: 0.6,
    layer: "top",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_c14_2",
    pcb_component_id: "pcb_component_c14",
    shape: "circle",
    x: 0.25,
    y: 0,
    radius: 0.3,
    layer: "top",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_ant1",
    pcb_component_id: "pcb_component_ant1",
    shape: "rect",
    x: 2,
    y: 0,
    width: 0.6,
    height: 0.6,
    layer: "top",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_bottom",
    shape: "rect",
    x: 0,
    y: 0,
    width: 0.6,
    height: 0.6,
    layer: "bottom",
  },
  {
    type: "pcb_keepout",
    pcb_keepout_id: "pcb_keepout_antenna",
    shape: "rect",
    center: { x: 1, y: 0 },
    width: 4,
    height: 2,
    layers: ["top"],
    excluded_pcb_component_ids: ["pcb_component_ant1"],
  },
] as AnyCircuitElement[]

test("reports non-excluded component copper inside a keepout once", async () => {
  const errors = checkPcbCopperOverKeepout(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0]?.pcb_placement_error_id).toBe(
    "copper_over_keepout_pcb_component_c14_pcb_keepout_antenna",
  )
  expect(errors[0]?.message).toContain("C14")
  expect(errors[0]?.message).toContain("PCB keepout")
  expect(errors[0]?.message).not.toContain("pcb_keepout_antenna")

  const placementErrors = await runAllPlacementChecks(circuitJson)
  expect(
    placementErrors.some(
      (error) =>
        "pcb_placement_error_id" in error &&
        error.pcb_placement_error_id === errors[0]?.pcb_placement_error_id,
    ),
  ).toBe(true)
})

test("reports a via inside a circular keepout on a shared layer", () => {
  const errors = checkPcbCopperOverKeepout([
    {
      type: "pcb_via",
      pcb_via_id: "pcb_via_1",
      x: 1,
      y: 1,
      hole_diameter: 0.2,
      outer_diameter: 0.5,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_keepout",
      pcb_keepout_id: "pcb_keepout_circle",
      shape: "circle",
      center: { x: 1, y: 1 },
      radius: 1,
      layers: ["bottom"],
    },
  ] as AnyCircuitElement[])

  expect(errors).toHaveLength(1)
  expect(errors[0]?.pcb_placement_error_id).toBe(
    "copper_over_keepout_pcb_via_1_pcb_keepout_circle",
  )
})
