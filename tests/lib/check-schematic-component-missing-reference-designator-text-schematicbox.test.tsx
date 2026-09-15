import { expect, test } from "bun:test"
import { checkSchematicComponentMissingReferenceDesignatorText } from "lib/check-schematic-component-missing-reference-designator-text"
import { Circuit } from "tscircuit"
import { createReferenceDesignatorCircuitJson } from "tests/fixtures/create-reference-designator-circuit-json"

test.each(["U1_Clock_reset_and_debug", "Clock_reset_and_debug", undefined])(
  "does not warn for schematicbox section label %s",
  async (name) => {
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
    expect(warnings).toHaveLength(0)
  },
)

test("skips boxes without separate text but still checks custom symbols", () => {
  const circuitJson = createReferenceDesignatorCircuitJson()
  const schematicComponent = circuitJson.find(
    (element) => element.type === "schematic_component",
  )!

  expect(
    checkSchematicComponentMissingReferenceDesignatorText(circuitJson),
  ).toHaveLength(1)

  schematicComponent.is_box_with_pins = true
  expect(
    checkSchematicComponentMissingReferenceDesignatorText(circuitJson),
  ).toHaveLength(0)
})
