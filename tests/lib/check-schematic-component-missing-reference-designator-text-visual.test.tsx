import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { checkSchematicComponentMissingReferenceDesignatorText } from "lib/check-schematic-component-missing-reference-designator-text"
import { Circuit } from "tscircuit"

const CUSTOM_SYMBOL = (
  <symbol>
    <schematicrect width={2} height={1} isFilled fillColor="#fff7cc" />
    <schematictext text="CUSTOM" fontSize={0.18} />
  </symbol>
)

test("warns visually for a TSX custom symbol without a refdes", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      {/* @ts-expect-error Intentionally omit the required refdes. */}
      <chip symbol={CUSTOM_SYMBOL} />
    </board>,
  )

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const warnings =
    checkSchematicComponentMissingReferenceDesignatorText(circuitJson)

  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    type: "schematic_component_styling_warning",
    styling_issue_type: "missing_reference_designator_text",
    message:
      'Schematic component is missing schematic reference designator text; add name="{REFDES}" (for example, name="U1") and include <schematictext text="{NAME}" /> in custom symbols',
  })
  expect(
    convertCircuitJsonToSchematicSvg([...circuitJson, ...warnings], {
      width: 600,
      height: 400,
      grid: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path, "custom-symbol-missing-refdes")
})

test("accepts a TSX custom symbol with a refdes placeholder", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <chip
        name="U1"
        symbol={
          <symbol>
            <schematicrect width={2} height={1} isFilled={false} />
            <schematictext text="{NAME}" schY={0.7} fontSize={0.18} />
          </symbol>
        }
      />
    </board>,
  )

  await circuit.renderUntilSettled()

  expect(
    checkSchematicComponentMissingReferenceDesignatorText(
      circuit.getCircuitJson(),
    ),
  ).toHaveLength(0)
})
