import { expect, test } from "bun:test"
import { checkSchematicComponentMissingReferenceDesignatorText } from "lib/check-schematic-component-missing-reference-designator-text"
import { Circuit } from "tscircuit"

const CustomSymbol = ({ label }: { label?: string }) => (
  <symbol>
    <schematicrect width={2} height={1} />
    {label && <schematictext text={label} fontSize={0.18} />}
  </symbol>
)

test("a custom symbol label on another sheet cannot hide a missing designator", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <schematicsheet name="A" />
      <schematicsheet name="B" />
      <chip
        name="U1"
        displayName="AMP"
        schSheetName="A"
        schX={0}
        schY={0}
        symbol={<CustomSymbol />}
      />
      <chip
        name="U2"
        displayName="AMP"
        schSheetName="B"
        schX={0}
        schY={0}
        symbol={<CustomSymbol label="AMP" />}
      />
    </board>,
  )

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const unlabeledSource = circuitJson.find(
    (element) => element.type === "source_component" && element.name === "U1",
  )
  expect(unlabeledSource?.type).toBe("source_component")
  if (unlabeledSource?.type !== "source_component") {
    throw new Error("Expected the unlabeled source component")
  }

  const unlabeledComponent = circuitJson.find(
    (element) =>
      element.type === "schematic_component" &&
      element.source_component_id === unlabeledSource.source_component_id,
  )
  const label = circuitJson.find(
    (element) => element.type === "schematic_text" && element.text === "AMP",
  )
  if (
    unlabeledComponent?.type !== "schematic_component" ||
    label?.type !== "schematic_text"
  ) {
    throw new Error("Expected the rendered component and custom symbol label")
  }
  expect(label.position).toEqual(unlabeledComponent.center)
  expect(label.schematic_symbol_id).toBeDefined()
  expect(label.schematic_component_id).toBeUndefined()
  expect(label.schematic_sheet_id).toBeDefined()
  expect(unlabeledComponent.schematic_sheet_id).toBeDefined()
  expect(label.schematic_sheet_id).not.toBe(
    unlabeledComponent.schematic_sheet_id,
  )

  const warnings =
    checkSchematicComponentMissingReferenceDesignatorText(circuitJson)
  expect(warnings).toHaveLength(1)
  expect(warnings[0]?.source_component_id).toBe(
    unlabeledSource.source_component_id,
  )
  expect(warnings[0]?.schematic_sheet_id).toBe(
    unlabeledComponent.schematic_sheet_id,
  )
})

test.each(["A", undefined])(
  "accepts a custom symbol's own label with sheet %s",
  async (sheetName) => {
    const circuit = new Circuit()
    circuit.pcbDisabled = true
    circuit.add(
      <board>
        {sheetName && <schematicsheet name={sheetName} />}
        <chip
          name="U1"
          schSheetName={sheetName}
          schX={0}
          schY={0}
          symbol={<CustomSymbol label="{REF}" />}
        />
      </board>,
    )

    await circuit.renderUntilSettled()
    const circuitJson = circuit.getCircuitJson()
    expect(
      circuitJson.some(
        (element) => element.type === "schematic_text" && element.text === "U1",
      ),
    ).toBe(true)
    expect(
      checkSchematicComponentMissingReferenceDesignatorText(circuitJson),
    ).toHaveLength(0)
  },
)
