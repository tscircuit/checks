import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { runAllSchematicChecks } from "../.."
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"
import { Tps25751Evm } from "./tps25751evm"

test("TI TPS25751EVM has no schematic style warnings across all seven sheets", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(<Tps25751Evm />)
  await circuit.renderUntilSettled()

  const circuitJson = normalizeFixtureSourcePorts(circuit.getCircuitJson())
  const sheets = circuitJson.filter(
    (element) => element.type === "schematic_sheet",
  )
  expect(sheets).toHaveLength(7)

  const warnings = await runAllSchematicChecks(circuitJson)
  expect(warnings).toEqual([])

  for (const sheet of sheets) {
    expect(
      convertCircuitJsonToSchematicSvg(circuitJson, {
        schematicSheetId: sheet.schematic_sheet_id,
        width: 2400,
      }),
    ).toMatchSvgSnapshot(import.meta.path, sheet.name)
  }
})
