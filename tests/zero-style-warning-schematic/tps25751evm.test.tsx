import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { runAllSchematicChecks } from "../.."
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"
import { Tps25751Evm } from "./tps25751evm"

test("TI TPS25751EVM schematic emits only the known box sizing warnings across all seven sheets", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(<Tps25751Evm />)
  await circuit.renderUntilSettled()

  const circuitJson = normalizeFixtureSourcePorts(circuit.getCircuitJson())
  const sheets = circuitJson.filter(
    (element) => element.type === "schematic_sheet",
  )
  expect(sheets).toHaveLength(7)

  const db = cju(circuitJson)
  const warnings = await runAllSchematicChecks(circuitJson)
  const warningSummaries = warnings
    .map((warning) => {
      const sheetName =
        sheets.find(
          (sheet) => sheet.schematic_sheet_id === warning.schematic_sheet_id,
        )?.name ?? ""
      const sourceComponentId = db.schematic_component.get(
        warning.schematic_component_id,
      )?.source_component_id
      const componentName = sourceComponentId
        ? db.source_component.get(sourceComponentId)?.name
        : undefined
      return `${sheetName} ${componentName} ${warning.styling_issue_type}`
    })
    .sort()

  expect(warningSummaries).toEqual([
    "pd-controller U4 schematic_box_too_wide",
    "pd-controller U4 schematic_pin_padding_to_edge_too_large",
    "pd-controller U5 schematic_box_too_wide",
    // False positive: padding is half of the drawn 0.8 pin pitch.
    "pd-controller U5 schematic_pin_padding_to_edge_too_large",
    "port-protection U12 schematic_box_too_wide",
    "power-input U1 schematic_box_too_wide",
    "power-input U1 schematic_pin_padding_to_edge_too_large",
    "power-stage U10 schematic_box_too_wide",
    "power-stage U11 schematic_box_too_wide",
    "power-stage U11 schematic_pin_padding_to_edge_too_large",
    // False positive: padding equals the drawn 0.4 pin pitch.
    "tiva-programmer J11 schematic_pin_padding_to_edge_too_large",
    "tiva-programmer U6 schematic_box_too_wide",
    "tiva-programmer U6 schematic_pin_padding_to_edge_too_large",
    "tiva-programmer U7 schematic_box_too_wide",
    "tiva-programmer U7 schematic_pin_padding_to_edge_too_large",
    "tiva-programmer U8 schematic_box_too_wide",
    "tiva-programmer U8 schematic_pin_padding_to_edge_too_large",
    "usb-connectors J2 schematic_box_too_wide",
    // False positives (J2-J7): padding equals the drawn pin pitch. The
    // analyzer compares against the nominal 0.2 pin_spacing instead.
    "usb-connectors J2 schematic_pin_padding_to_edge_too_large",
    "usb-connectors J3 schematic_box_too_wide",
    "usb-connectors J3 schematic_pin_padding_to_edge_too_large",
    "usb-connectors J4 schematic_box_too_wide",
    "usb-connectors J4 schematic_pin_padding_to_edge_too_large",
    "usb-connectors J5 schematic_box_too_wide",
    "usb-connectors J5 schematic_pin_padding_to_edge_too_large",
    "usb-connectors J6 schematic_pin_padding_to_edge_too_large",
    "usb-connectors J7 schematic_pin_padding_to_edge_too_large",
  ])

  for (const sheet of sheets) {
    expect(
      convertCircuitJsonToSchematicSvg(circuitJson, {
        schematicSheetId: sheet.schematic_sheet_id,
        width: 2400,
      }),
    ).toMatchSvgSnapshot(import.meta.path, sheet.name)
  }
})
