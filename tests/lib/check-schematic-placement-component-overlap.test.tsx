import { expect, test } from "bun:test"
import { schematic_component_styling_warning } from "circuit-json"
import {
  checkSchematicPlacement,
  runAllChecks,
  runAllSchematicChecks,
} from "../.."
import { Circuit } from "tscircuit"
import { Fragment } from "react"
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"
import { containsCircuitJsonId } from "lib/util/get-readable-names"

async function createSchematicBoxes(sheets = [[0, 0.4, 0.8]]) {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board schAutoLayoutEnabled={false}>
      {sheets.map((positions, index) => (
        <Fragment key={index}>
          <schematicsheet name={`Sheet ${index + 1}`}>
            <subcircuit name={`Sheet${index + 1}`} schAutoLayoutEnabled={false}>
              {positions.map((x, i) => (
                <chip
                  name={`U${i + 1}`}
                  key={i}
                  schX={x}
                  schY={0}
                  schWidth={2}
                  schHeight={2}
                />
              ))}
            </subcircuit>
          </schematicsheet>
        </Fragment>
      ))}
    </board>,
  )
  await circuit.renderUntilSettled()
  return normalizeFixtureSourcePorts(circuit.getCircuitJson())
}

test("reports every overlapping component pair with unique IDs and correct sheet scope", async () => {
  const json = await createSchematicBoxes()
  const original = structuredClone(json)
  const warnings = checkSchematicPlacement(json)
  expect(warnings).toHaveLength(3)
  expect(
    new Set(warnings.map((w) => w.schematic_component_styling_warning_id)).size,
  ).toBe(3)
  expect(warnings[0]!.message).toContain("U1 overlaps U2")
  for (const w of warnings) {
    expect(schematic_component_styling_warning.parse(w)).toEqual(w)
    expect(w.styling_issue_type).toBe("component_overlap")
    const component = json.find(
      (e) =>
        e.type === "schematic_component" &&
        e.schematic_component_id === w.schematic_component_id,
    )!
    if (component.type !== "schematic_component")
      throw new Error("Missing component")
    const group = json.find(
      (e) =>
        e.type === "schematic_group" &&
        e.schematic_group_id === component.schematic_group_id,
    )!
    if (group.type !== "schematic_group") throw new Error("Missing group")
    expect(w.schematic_sheet_id).toBe(component.schematic_sheet_id)
    expect(w.subcircuit_id).toBe(group.subcircuit_id)
  }
  for (const run of [runAllChecks, runAllSchematicChecks]) {
    expect(
      (await run(structuredClone(json))).filter(
        (w) =>
          w.type === "schematic_component_styling_warning" &&
          w.styling_issue_type === "component_overlap",
      ),
    ).toEqual(warnings)
  }
  expect(checkSchematicPlacement([...json, ...warnings])).toEqual(warnings)
  expect(json).toEqual(original)
  expect(
    checkSchematicPlacement(await createSchematicBoxes([[0, 3, 6]])),
  ).toEqual([])
  const separateSheets = await createSchematicBoxes([[0], [0]])
  expect(checkSchematicPlacement(separateSheets)).toEqual([])
  for (const e of json) if (e.type === "source_component") e.name = ""
  const unnamed = checkSchematicPlacement(json)
  expect(unnamed).toHaveLength(3)
  expect(unnamed[0]!.message).toContain(
    "unnamed component overlaps unnamed component",
  )
  expect(unnamed.every((w) => !containsCircuitJsonId(w.message))).toBe(true)
})
