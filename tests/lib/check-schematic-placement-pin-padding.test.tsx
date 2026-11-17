import { expect, test } from "bun:test"
import { analyzeSchematicPlacement } from "@tscircuit/circuit-json-schematic-placement-analysis/analysis"
import { schematic_component_styling_warning } from "circuit-json"
import { containsCircuitJsonId } from "lib/util/get-readable-names"
import { Circuit } from "tscircuit"
import {
  checkSchematicPlacement,
  runAllChecks,
  runAllSchematicChecks,
} from "../.."
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"

async function createBox({
  axis,
  width,
  height,
}: {
  axis: "width" | "height"
  width?: number
  height?: number
}) {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board routingDisabled>
      <schematicsheet name="Pin padding">
        <subcircuit name="Boxes" schAutoLayoutEnabled={false}>
          <chip
            name="U1"
            schWidth={width ?? (axis === "width" ? 2 : 1.2)}
            schHeight={height ?? (axis === "height" ? 2 : 1.2)}
            schPinSpacing={0.2}
            pinLabels={{ pin1: "A", pin2: "B", pin3: "C", pin4: "D" }}
            schPinArrangement={
              axis === "height"
                ? {
                    leftSide: { pins: [1, 2], direction: "top-to-bottom" },
                    rightSide: { pins: [3, 4], direction: "top-to-bottom" },
                  }
                : {
                    topSide: { pins: [1, 2], direction: "left-to-right" },
                    bottomSide: { pins: [3, 4], direction: "left-to-right" },
                  }
            }
          />
        </subcircuit>
      </schematicsheet>
    </board>,
  )
  await circuit.renderUntilSettled()
  return normalizeFixtureSourcePorts(circuit.getCircuitJson())
}

test("reports excessive pin padding with the analyzer's width or height suggestion", async () => {
  for (const axis of ["width", "height"] as const) {
    const json = await createBox({ axis })
    const original = structuredClone(json)
    const issues = analyzeSchematicPlacement(json, {
      issueTypes: ["SchematicPinPaddingToEdgeTooLarge"],
    })
      .getIssues()
      .filter(
        (issue) => issue.lineItemType === "SchematicPinPaddingToEdgeTooLarge",
      )
    expect(issues).toHaveLength(1)
    const issue = issues[0]!
    const warnings = checkSchematicPlacement(json)
    expect(warnings).toHaveLength(1)
    const warning = warnings[0]!
    expect(schematic_component_styling_warning.parse(warning)).toEqual(warning)
    expect(warning.styling_issue_type).toBe(
      "schematic_pin_padding_to_edge_too_large",
    )
    expect(warning.message).toContain("U1 has excessive space")
    expect(warning.message).not.toContain("undefined")
    if (axis === "width") {
      expect(issue.suggestedSchWidth).toBeDefined()
      expect(warning.message).toContain(`schWidth=${issue.suggestedSchWidth}`)
      expect(warning.message).not.toContain("schHeight=")
    } else {
      expect(issue.suggestedSchHeight).toBeDefined()
      expect(warning.message).toContain(`schHeight=${issue.suggestedSchHeight}`)
      expect(warning.message).not.toContain("schWidth=")
    }
    const component = json.find((e) => e.type === "schematic_component")!
    const source = json.find((e) => e.type === "source_component")!
    const sheet = json.find((e) => e.type === "schematic_sheet")!
    const group = json.find((e) => e.type === "schematic_group")!
    expect(warning).toMatchObject({
      schematic_component_id: component.schematic_component_id,
      source_component_id: source.source_component_id,
      schematic_sheet_id: sheet.schematic_sheet_id,
      subcircuit_id: group.subcircuit_id,
      schematic_port_ids: json
        .filter((e) => e.type === "schematic_port")
        .map((p) => p.schematic_port_id),
    })
    for (const run of [runAllSchematicChecks, runAllChecks]) {
      expect(
        (await run(structuredClone(json))).filter(
          (w) =>
            w.type === "schematic_component_styling_warning" &&
            w.styling_issue_type === warning.styling_issue_type,
        ),
      ).toEqual(warnings)
    }
    expect(checkSchematicPlacement([...json, ...warnings])).toEqual(warnings)
    expect(json).toEqual(original)
    expect(
      checkSchematicPlacement(
        await createBox({
          axis,
          width: issue.suggestedSchWidth,
          height: issue.suggestedSchHeight,
        }),
      ),
    ).toEqual([])
    for (const e of json) if (e.type === "source_component") e.name = ""
    const unnamed = checkSchematicPlacement(json)
    expect(unnamed).toHaveLength(1)
    expect(unnamed[0]!.message).toContain("unnamed component")
    expect(containsCircuitJsonId(unnamed[0]!.message)).toBe(false)
  }
})
