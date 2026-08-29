import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkSchematicComponentMissingReferenceDesignatorText } from "lib/check-schematic-component-missing-reference-designator-text"
import { runAllSchematicChecks } from "lib/run-all-checks"

const createCircuitJson = ({
  displayName,
  texts = [],
}: {
  displayName?: string
  texts?: string[]
} = {}): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "source_component_1",
    name: "U1",
    display_name: displayName,
    ftype: "simple_chip",
  },
  {
    type: "schematic_component",
    schematic_component_id: "schematic_component_1",
    source_component_id: "source_component_1",
    center: { x: 0, y: 0 },
    size: { width: 2, height: 1 },
    is_box_with_pins: false,
  },
  ...texts.map(
    (text, index): AnyCircuitElement => ({
      type: "schematic_text",
      schematic_text_id: `schematic_text_${index + 1}`,
      schematic_component_id: "schematic_component_1",
      text,
      font_size: 0.18,
      position: { x: 0, y: index },
      rotation: 0,
      anchor: "left",
      color: "#006464",
    }),
  ),
]

describe("checkSchematicComponentMissingReferenceDesignatorText", () => {
  test("warns when the component has no attached reference designator text", () => {
    const warnings = checkSchematicComponentMissingReferenceDesignatorText(
      createCircuitJson({ texts: ["STM32F103"] }),
    )

    expect(warnings).toEqual([
      {
        type: "schematic_component_styling_warning",
        schematic_component_styling_warning_id:
          "schematic_component_styling_warning_schematic_component_1_missing_reference_designator_text",
        warning_type: "schematic_component_styling_warning",
        message:
          'U1 is missing schematic reference designator text; add name="{REFDES}" (for example, name="U1") and include <schematictext text="{NAME}" /> in custom symbols',
        schematic_component_id: "schematic_component_1",
        styling_issue_type: "missing_reference_designator_text",
        source_component_id: "source_component_1",
        schematic_sheet_id: undefined,
        subcircuit_id: undefined,
      },
    ])
  })

  test("does not warn when attached text matches the reference designator", () => {
    const warnings = checkSchematicComponentMissingReferenceDesignatorText(
      createCircuitJson({ texts: ["STM32F103", " U1 "] }),
    )

    expect(warnings).toHaveLength(0)
  })

  test("uses the display-name override as the rendered designator", () => {
    const warnings = checkSchematicComponentMissingReferenceDesignatorText(
      createCircuitJson({ displayName: "MCU", texts: ["MCU"] }),
    )

    expect(warnings).toHaveLength(0)
  })

  test("warns when an empty display-name override hides the designator", () => {
    const warnings = checkSchematicComponentMissingReferenceDesignatorText(
      createCircuitJson({ displayName: "", texts: [""] }),
    )

    expect(warnings).toHaveLength(1)
  })

  test("ignores schematic components without a source component", () => {
    const circuitJson = createCircuitJson().filter(
      (element) => element.type !== "source_component",
    )

    expect(
      checkSchematicComponentMissingReferenceDesignatorText(circuitJson),
    ).toHaveLength(0)
  })

  test("is included in runAllSchematicChecks", async () => {
    const warnings = await runAllSchematicChecks(createCircuitJson())

    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.styling_issue_type).toBe(
      "missing_reference_designator_text",
    )
  })
})
