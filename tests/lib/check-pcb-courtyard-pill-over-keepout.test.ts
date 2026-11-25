import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbCourtyardOverKeepout } from "lib/check-pcb-courtyard-over-keepout"

test("detects pcb_courtyard_pill overlapping a pcb_keepout", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "source_u1",
      name: "U1",
      ftype: "simple_chip",
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_u1",
      source_component_id: "source_u1",
      center: { x: 0, y: 0 },
      width: 6,
      height: 2,
      rotation: 0,
      layer: "top",
      obstructs_within_bounds: true,
    },
    {
      type: "pcb_courtyard_pill",
      pcb_courtyard_pill_id: "courtyard_pill_1",
      pcb_component_id: "pcb_u1",
      center: { x: 0, y: 0 },
      width: 6,
      height: 2,
      radius: 1,
      layer: "top",
    },
    {
      type: "pcb_keepout",
      pcb_keepout_id: "keepout_overlap",
      shape: "circle",
      center: { x: 3.2, y: 0 },
      radius: 0.5,
      layers: ["top"],
    },
    {
      type: "pcb_keepout",
      pcb_keepout_id: "keepout_clear",
      shape: "circle",
      center: { x: 10, y: 10 },
      radius: 0.5,
      layers: ["top"],
    },
  ]

  const errors = checkPcbCourtyardOverKeepout(circuitJson)

  expect(errors).toHaveLength(1)
  const firstError = errors[0]!
  expect(firstError.type).toBe("pcb_placement_error")
  if (firstError.type === "pcb_placement_error") {
    expect(firstError.pcb_placement_error_id).toBe(
      "courtyard_over_keepout_pcb_u1_keepout_overlap",
    )
  }
})
