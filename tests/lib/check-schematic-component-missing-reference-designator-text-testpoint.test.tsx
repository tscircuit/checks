import { expect, test } from "bun:test"
import { checkSchematicComponentMissingReferenceDesignatorText } from "lib/check-schematic-component-missing-reference-designator-text"
import { runAllSchematicChecks } from "lib/run-all-checks"
import { Circuit } from "tscircuit"

test.each([0, 90, 180, 270])(
  "accepts a test point's symbol-rendered reference designator at %s degrees",
  async (schRotation) => {
    const circuit = new Circuit()
    circuit.pcbDisabled = true
    circuit.add(
      <board>
        <testpoint name="TP6" schRotation={schRotation} />
      </board>,
    )
    await circuit.renderUntilSettled()
    const circuitJson = circuit.getCircuitJson()
    const sourceComponent = circuitJson.find(
      (element) => element.type === "source_component",
    )!
    expect(sourceComponent.name).toBe("TP6")
    expect(sourceComponent.ftype).toBe("simple_test_point")
    const schematicComponent = circuitJson.find(
      (element) => element.type === "schematic_component",
    )!
    expect(schematicComponent.source_component_id).toBe(
      sourceComponent.source_component_id,
    )
    expect(schematicComponent.symbol_name).toMatch(/^testpoint_/)
    // The symbol supplies TP6; core does not emit a separate schematic_text.
    expect(
      circuitJson.some(
        (element) =>
          element.type === "schematic_text" && element.text === "TP6",
      ),
    ).toBe(false)
    expect(
      checkSchematicComponentMissingReferenceDesignatorText(circuitJson),
    ).toEqual([])
    expect(
      (await runAllSchematicChecks(circuitJson)).filter(
        (element) =>
          element.type === "schematic_component_styling_warning" &&
          element.styling_issue_type === "missing_reference_designator_text",
      ),
    ).toEqual([])
  },
)
