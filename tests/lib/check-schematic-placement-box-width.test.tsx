import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { runAllSchematicChecks } from "../.."
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"

test("warns when chip and pin-header schematic boxes are too wide", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  const boxProps = {
    schWidth: 3,
    schHeight: 1,
    schPinSpacing: 0.2,
    pinLabels: { pin1: "A", pin2: "B", pin3: "C", pin4: "D" },
    schPinArrangement: {
      rightSide: { pins: [1, 2, 3, 4], direction: "top-to-bottom" as const },
    },
  }
  circuit.add(
    <board routingDisabled>
      <chip {...boxProps} name="U1" schX={-3} />
      <pinheader {...boxProps} name="J1" schX={3} pinCount={4} />
    </board>,
  )
  await circuit.renderUntilSettled()
  const json = normalizeFixtureSourcePorts(circuit.getCircuitJson())
  const warnings = await runAllSchematicChecks(json)
  expect(warnings).toHaveLength(2)
  expect(warnings).toMatchObject([
    {
      type: "schematic_component_styling_warning",
      styling_issue_type: "schematic_box_too_wide",
    },
    {
      type: "schematic_component_styling_warning",
      styling_issue_type: "schematic_box_too_wide",
    },
  ])
})
