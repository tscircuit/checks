import { expect, test } from "bun:test"
import { runAllChecks } from "../.." // index.ts when imported from root
import type { AnyCircuitElement } from "circuit-json"

test("runAllChecks executes checks on tscircuit code", async () => {
  // Simple circuit JSON with a resistor component (no PCB traces, so should have no errors)
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "R1",
      ftype: "simple_resistor",
      name: "R1",
      resistance: 1000,
      supplier_part_numbers: {},
    },
    {
      type: "source_port",
      source_port_id: "R1_pin1",
      name: "pin1",
      pin_number: 1,
      port_hints: ["1"],
      source_component_id: "R1",
    },
    {
      type: "source_port",
      source_port_id: "R1_pin2",
      name: "pin2",
      pin_number: 2,
      port_hints: ["2"],
      source_component_id: "R1",
    },
  ]

  const errors = await runAllChecks(circuitJson)
  expect(Array.isArray(errors)).toBe(true)
  expect(errors.length).toBe(0)
})
