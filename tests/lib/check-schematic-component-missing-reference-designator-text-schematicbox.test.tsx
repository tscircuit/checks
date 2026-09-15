import { expect, test } from "bun:test"
import { checkSchematicComponentMissingReferenceDesignatorText } from "lib/check-schematic-component-missing-reference-designator-text"
import { Circuit } from "tscircuit"
import { createReferenceDesignatorCircuitJson } from "tests/fixtures/create-reference-designator-circuit-json"

test.each([
  ["U1_Clock_reset_and_debug", false],
  ["U1 Power", false],
  ["U1-Power", false],
  ["U1A", false],
  [undefined, false],
  ["U10_Clock_reset_and_debug", true],
  ["Clock_reset_and_debug", true],
  ["", true],
] as const)(
  "checks schematicbox section label %s",
  async (name, shouldWarn) => {
    const circuit = new Circuit()
    circuit.pcbDisabled = true
    circuit.add(
      <board>
        <chip
          name="U1"
          manufacturerPartNumber="AM3352BZCZ100"
          pinLabels={{ pin1: "RTC_XTALOUT", pin2: "TDO" }}
        />
        <schematicbox
          name={name}
          chipRef=".U1"
          schX={5}
          width={3}
          height={2}
          pinLabels={{ pin1: "RTC_XTALOUT", pin2: "TDO" }}
          schPinArrangement={{ leftSide: [1], rightSide: [2] }}
        />
      </board>,
    )
    await circuit.renderUntilSettled()
    const circuitJson = circuit.getCircuitJson()
    const sectionText = circuitJson.find(
      (element) =>
        element.type === "schematic_text" && element.text === (name ?? ".U1"),
    )
    expect(sectionText).toBeDefined()
    const warnings =
      checkSchematicComponentMissingReferenceDesignatorText(circuitJson)
    expect(warnings).toHaveLength(shouldWarn ? 1 : 0)
    if (shouldWarn) {
      expect(warnings[0]).toMatchObject({
        schematic_component_id:
          sectionText?.type === "schematic_text"
            ? sectionText.schematic_component_id
            : undefined,
      })
    }
  },
)

test("section labels only satisfy the box they are attached to", () => {
  const circuitJson = createReferenceDesignatorCircuitJson({
    texts: ["U1_Clock_reset_and_debug"],
  })
  const schematicComponent = circuitJson.find(
    (element) => element.type === "schematic_component",
  )!

  // A custom symbol still needs its exact reference designator.
  expect(
    checkSchematicComponentMissingReferenceDesignatorText(circuitJson),
  ).toHaveLength(1)

  schematicComponent.is_box_with_pins = true
  expect(
    checkSchematicComponentMissingReferenceDesignatorText(circuitJson),
  ).toHaveLength(0)

  const schematicText = circuitJson.find(
    (element) => element.type === "schematic_text",
  )!
  schematicText.schematic_component_id = "another_schematic_component"
  expect(
    checkSchematicComponentMissingReferenceDesignatorText(circuitJson),
  ).toHaveLength(1)
})
