import { expect, test } from "bun:test"
import { analyzeSchematicPlacement } from "@tscircuit/circuit-json-schematic-placement-analysis/analysis"
import { schematic_component_styling_warning } from "circuit-json"
import {
  checkSchematicPlacement,
  runAllChecks,
  runAllSchematicChecks,
} from "../.."
import { Circuit } from "tscircuit"
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"
import { containsCircuitJsonId } from "lib/util/get-readable-names"

async function createTextCollision({
  kind,
  corrected = false,
}: {
  kind: "component" | "text" | "trace" | "standalone"
  corrected?: boolean
}) {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board schTraceAutoLabelEnabled={false} schMaxTraceDistance={100}>
      <schematicsheet name="Text collisions">
        <subcircuit name="Annotations" schAutoLayoutEnabled={false}>
          {kind !== "standalone" && (
            <chip
              name="U1"
              schX={kind === "component" ? 0 : -4}
              schY={0}
              schWidth={1}
              schHeight={1}
              schPinArrangement={{
                rightSide: { pins: [1], direction: "top-to-bottom" },
              }}
            />
          )}
          {kind === "text" && (
            <>
              <chip
                name="U2"
                schX={4}
                schY={0}
                schWidth={1}
                schHeight={1}
                schPinArrangement={{
                  leftSide: { pins: [1], direction: "top-to-bottom" },
                }}
              />
              <trace
                from=".U1 > .pin1"
                to=".U2 > .pin1"
                schDisplayLabel="SIGNAL"
              />
            </>
          )}
          {kind === "trace" && (
            <>
              <net name="SIGNAL" />
              <netlabel
                net="SIGNAL"
                connectsTo="U1.pin1"
                schX={4}
                schY={0}
                anchorSide="left"
              />
            </>
          )}
          <schematictext
            text="NOTE"
            fontSize={0.3}
            schX={0}
            schY={corrected ? 5 : kind === "text" ? 0.18 : 0}
            anchor="center"
          />
          {kind === "standalone" && (
            <schematictext
              text="OTHER"
              fontSize={0.3}
              schX={0.2}
              schY={0}
              anchor="center"
            />
          )}
        </subcircuit>
      </schematicsheet>
    </board>,
  )
  await circuit.renderUntilSettled()
  return normalizeFixtureSourcePorts(circuit.getCircuitJson())
}

test("reports component-associated text collisions using body and trace ownership without inventing targets", async () => {
  for (const kind of ["component", "text", "trace"] as const) {
    const json = await createTextCollision({ kind })
    const original = structuredClone(json)
    const warnings = checkSchematicPlacement(json)
    expect(warnings).toHaveLength(kind === "text" ? 2 : 1)
    for (const w of warnings) {
      expect(schematic_component_styling_warning.parse(w)).toEqual(w)
      expect(w.styling_issue_type).toBe("schematic_text_collision")
      const target =
        kind === "component" ? "U1" : kind === "text" ? "SIGNAL" : "a trace"
      expect(w.message).toContain(`Text "NOTE" overlaps ${target}`)
      const sheet = json.find((e) => e.type === "schematic_sheet")!
      if (sheet.type !== "schematic_sheet") throw new Error("Missing sheet")
      expect(w.schematic_sheet_id).toBe(sheet.schematic_sheet_id)
      expect(w.schematic_port_ids).toHaveLength(1)
      expect(containsCircuitJsonId(w.message)).toBe(false)
    }
    for (const run of [runAllChecks, runAllSchematicChecks]) {
      expect(
        (await run(structuredClone(json))).filter(
          (w) =>
            w.type === "schematic_component_styling_warning" &&
            w.styling_issue_type === "schematic_text_collision",
        ),
      ).toEqual(warnings)
    }
    expect(checkSchematicPlacement([...json, ...warnings])).toEqual(warnings)
    expect(json).toEqual(original)
    expect(
      checkSchematicPlacement(
        await createTextCollision({ kind, corrected: true }),
      ),
    ).toEqual([])
    for (const e of json) {
      if (e.type === "source_component") e.name = ""
      if (e.type === "schematic_text") e.text = e.schematic_text_id
    }
    const unnamed = checkSchematicPlacement(json)
    expect(unnamed.length).toBeGreaterThan(0)
    expect(unnamed.every((w) => !containsCircuitJsonId(w.message))).toBe(true)
  }
  const standalone = await createTextCollision({ kind: "standalone" })
  expect(
    analyzeSchematicPlacement(standalone, {
      issueTypes: ["SchematicTextCollision"],
    }).getIssues(),
  ).toHaveLength(1)
  // The existing output schema requires a real component reference. Unowned
  // text-only collisions must not be attached to a fabricated component.
  expect(checkSchematicPlacement(standalone)).toEqual([])
})
