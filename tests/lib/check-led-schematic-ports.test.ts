import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkLedSchematicPorts } from "lib/check-led-schematic-ports"
import { runAllSchematicChecks } from "lib/run-all-checks"

const createLedCircuitJson = (
  representedSourcePortIds: string[],
): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "source_component_led1",
    name: "LED1",
    ftype: "simple_led",
  },
  ...[1, 2].map(
    (pinNumber): AnyCircuitElement => ({
      type: "source_port",
      source_port_id: `source_port_led1_${pinNumber}`,
      source_component_id: "source_component_led1",
      name: `pin${pinNumber}`,
      pin_number: pinNumber,
      port_hints: [`pin${pinNumber}`],
    }),
  ),
  {
    type: "schematic_component",
    schematic_component_id: "schematic_component_led1",
    source_component_id: "source_component_led1",
    center: { x: 0, y: 0 },
    size: { width: 1, height: 1 },
    is_box_with_pins: true,
    symbol_name: "led_right",
  },
  ...representedSourcePortIds.map(
    (sourcePortId, index): AnyCircuitElement => ({
      type: "schematic_port",
      schematic_port_id: `schematic_port_led1_${index + 1}`,
      source_port_id: sourcePortId,
      schematic_component_id: "schematic_component_led1",
      center: { x: index, y: 0 },
    }),
  ),
]

test("errors when an LED symbol is missing schematic ports", async () => {
  const circuitJson = createLedCircuitJson([])

  expect(checkLedSchematicPorts(circuitJson)).toEqual([
    expect.objectContaining({
      type: "schematic_error",
      error_type: "schematic_port_not_found",
    }),
  ])
  expect(await runAllSchematicChecks(circuitJson)).toEqual(
    expect.arrayContaining(checkLedSchematicPorts(circuitJson)),
  )
})

test("errors when an LED has no schematic component", () => {
  const circuitJson = createLedCircuitJson([]).filter(
    (element) =>
      element.type !== "schematic_component" &&
      element.type !== "schematic_port",
  )

  expect(checkLedSchematicPorts(circuitJson)).toEqual([
    expect.objectContaining({
      type: "schematic_error",
      message: "LED LED1 does not have a schematic component",
    }),
  ])
})

test("accepts an LED whose two source ports are represented", () => {
  const circuitJson = createLedCircuitJson([
    "source_port_led1_1",
    "source_port_led1_2",
  ])

  expect(checkLedSchematicPorts(circuitJson)).toEqual([])
})
