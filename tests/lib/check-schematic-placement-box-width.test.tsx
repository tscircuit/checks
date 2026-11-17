import { expect, test } from "bun:test"
import { containsCircuitJsonId } from "lib/util/get-readable-names"
import { Circuit } from "tscircuit"
import { checkSchematicPlacement, runAllSchematicChecks } from "../.."
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
  for (const warning of warnings) {
    expect(warning).toMatchObject({
      type: "schematic_component_styling_warning",
      styling_issue_type: "schematic_box_too_wide",
    })
  }
  expect(warnings[0]!.message).toContain("U1")
  expect(warnings[1]!.message).toContain("J1")

  for (const element of json) {
    if (element.type === "source_component") element.name = ""
  }
  const unnamed = checkSchematicPlacement(json)
  expect(unnamed).toHaveLength(2)
  for (const warning of unnamed) {
    expect(warning.message).toContain("unnamed component")
    expect(containsCircuitJsonId(warning.message)).toBe(false)
  }
})
