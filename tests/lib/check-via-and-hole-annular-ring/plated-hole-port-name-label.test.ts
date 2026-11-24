import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"

test("a plated hole prints its port name, or the unnamed label without one", () => {
  const namedCircuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "source_component_j1",
      ftype: "simple_connector",
      name: "J1",
    },
    {
      type: "source_port",
      source_port_id: "source_port_j1_1",
      source_component_id: "source_component_j1",
      name: "1",
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_j1_1",
      source_port_id: "source_port_j1_1",
      x: 2,
      y: 1,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "plated_1",
      pcb_port_id: "pcb_port_j1_1",
      shape: "circle",
      x: 2,
      y: 1,
      hole_diameter: 0.8,
      outer_diameter: 1,
      layers: ["top", "bottom"],
    },
  ]

  const namedErrors = checkViaAndHoleAnnularRing(namedCircuitJson)
  expect(namedErrors).toHaveLength(1)
  const namedMessage = namedErrors[0]!.message
  expect(
    namedMessage.startsWith("Through-hole pad J1.1 at (2.00mm, 1.00mm): "),
  ).toBe(true)
  expect(namedMessage).not.toContain("plated_1")

  const unnamedErrors = checkViaAndHoleAnnularRing([
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "plated_1",
      shape: "circle",
      x: 2,
      y: 1,
      hole_diameter: 0.8,
      outer_diameter: 1,
      layers: ["top", "bottom"],
    },
  ])
  expect(unnamedErrors).toHaveLength(1)
  const unnamedMessage = unnamedErrors[0]!.message
  expect(
    unnamedMessage.startsWith("Unnamed through-hole pad at (2.00mm, 1.00mm): "),
  ).toBe(true)
  expect(unnamedMessage).not.toContain("plated_1")
})
