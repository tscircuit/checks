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
  kind,
  width = 3,
}: {
  kind: "chip" | "pinheader"
  width?: number
}) {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  const props = {
    name: kind === "chip" ? "U1" : "J1",
    schWidth: width,
    schHeight: 1,
    schPinSpacing: 0.2,
    pinLabels: { pin1: "A", pin2: "B", pin3: "C", pin4: "D" },
    schPinArrangement: {
      rightSide: { pins: [1, 2, 3, 4], direction: "top-to-bottom" as const },
    },
  }
  circuit.add(
    <board routingDisabled>
      <schematicsheet name="Box width">
        <subcircuit name="Boxes" schAutoLayoutEnabled={false}>
          {kind === "chip" ? (
            <chip {...props} />
          ) : (
            <pinheader {...props} pinCount={4} />
          )}
        </subcircuit>
      </schematicsheet>
    </board>,
  )
  await circuit.renderUntilSettled()
  return normalizeFixtureSourcePorts(circuit.getCircuitJson())
}

test("reports chip and pin-header box width suggestions through both check entry points", async () => {
  for (const kind of ["chip", "pinheader"] as const) {
    const json = await createBox({ kind })
    const original = structuredClone(json)
    const issueType =
      kind === "chip"
        ? "GenericSchematicBoxTooWide"
        : "PinHeaderSchematicBoxTooWide"
    const issues = analyzeSchematicPlacement(json, {
      issueTypes: [issueType],
    })
      .getIssues()
      .filter(
        (issue) =>
          issue.lineItemType === "GenericSchematicBoxTooWide" ||
          issue.lineItemType === "PinHeaderSchematicBoxTooWide",
      )
    expect(issues).toHaveLength(1)
    const issue = issues[0]!
    expect(issue.lineItemType).toBe(issueType)
    const warnings = checkSchematicPlacement(json)
    expect(warnings).toHaveLength(1)
    const warning = warnings[0]!
    expect(schematic_component_styling_warning.parse(warning)).toEqual(warning)
    expect(warning.styling_issue_type).toBe("schematic_box_too_wide")
    expect(warning.message).toContain(kind === "chip" ? "U1" : "J1")
    expect(warning.message).toContain(`schWidth to ${issue.suggestedSchWidth}`)
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
        await createBox({ kind, width: issue.suggestedSchWidth }),
      ),
    ).toEqual([])
    for (const e of json) if (e.type === "source_component") e.name = ""
    const unnamed = checkSchematicPlacement(json)
    expect(unnamed).toHaveLength(1)
    expect(unnamed[0]!.message).toContain("unnamed component")
    expect(containsCircuitJsonId(unnamed[0]!.message)).toBe(false)
  }
})
