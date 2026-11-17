import { expect, test } from "bun:test"
import { containsCircuitJsonId } from "lib/util/get-readable-names"
import { Circuit } from "tscircuit"
import { checkSchematicPlacement, runAllSchematicChecks } from "../.."
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"

test("warns when a schematic box has excessive pin padding", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board routingDisabled>
      <chip
        name="U1"
        schWidth={1.2}
        schHeight={1.2}
        schPinSpacing={0.2}
        pinLabels={{ pin1: "A", pin2: "B", pin3: "C", pin4: "D" }}
        schPinArrangement={{
          leftSide: { pins: [1, 2], direction: "top-to-bottom" },
          rightSide: { pins: [3, 4], direction: "top-to-bottom" },
        }}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const json = normalizeFixtureSourcePorts(circuit.getCircuitJson())
  const warnings = await runAllSchematicChecks(json)
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    type: "schematic_component_styling_warning",
    styling_issue_type: "schematic_pin_padding_to_edge_too_large",
  })
  expect(warnings[0]!.message).toContain("U1")

  for (const element of json) {
    if (element.type === "source_component") element.name = ""
  }
  const unnamed = checkSchematicPlacement(json)
  expect(unnamed).toHaveLength(1)
  expect(unnamed[0]!.message).toContain("unnamed component")
  expect(containsCircuitJsonId(unnamed[0]!.message)).toBe(false)
})
