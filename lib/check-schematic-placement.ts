import { getReadableNameForElementId } from "lib/util/get-readable-names"
import { analyzeSchematicPlacement } from "@tscircuit/circuit-json-schematic-placement-analysis/analysis"
import { cju } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  SchematicComponentStylingWarning,
} from "circuit-json"

// Enable reviewed placement findings individually as schematic warnings.
const enabledIssueTypes = [
  "TwoPinComponentHasInvertedRails",
  "RegulatorCapacitorsOnWrongSides",
  "PullResistorOnWrongSide",
  "VoltageDividerSupplyResistorBelowGroundResistor",
  "SeriesLedChainNotOrdered",
  "ParallelRcNotAligned",
] as const

export function checkSchematicPlacement(
  circuitJson: AnyCircuitElement[],
): SchematicComponentStylingWarning[] {
  const analysis = analyzeSchematicPlacement(circuitJson, {
    issueTypes: enabledIssueTypes,
  })
  const db = cju(circuitJson)
  return analysis
    .getIssues()
    .flatMap((issue): SchematicComponentStylingWarning[] => {
      let schematicComponentId: string | undefined
      let stylingIssueType: string
      let message: string
      switch (issue.lineItemType) {
        case "TwoPinComponentHasInvertedRails": {
          schematicComponentId = issue.schematicBox.schematicComponentId
          const componentName = getReadableNameForElementId(
            circuitJson,
            schematicComponentId ?? "",
          )
          stylingIssueType = "inverted_rails"
          message = `${componentName} has its positive-supply pin facing down. Rotate ${componentName} by 180° so that pin faces up, preserving pin connections, and reroute attached traces.`
          break
        }
        case "RegulatorCapacitorsOnWrongSides": {
          schematicComponentId =
            issue.regulatorSchematicBox.schematicComponentId
          const regulatorName = getReadableNameForElementId(
            circuitJson,
            schematicComponentId ?? "",
          )
          const inputCapacitorName = getReadableNameForElementId(
            circuitJson,
            issue.inputCapacitorSchematicBox.schematicComponentId ?? "",
          )
          const outputCapacitorName = getReadableNameForElementId(
            circuitJson,
            issue.outputCapacitorSchematicBox.schematicComponentId ?? "",
          )
          stylingIssueType = "regulator_capacitors_on_wrong_sides"
          message = `${inputCapacitorName} and ${outputCapacitorName} are on the wrong sides of ${regulatorName}. Move them beside their connected regulator pins, preserving connections and rerouting traces.`
          break
        }
        case "PullResistorOnWrongSide":
          schematicComponentId = issue.resistorSchematicBox.schematicComponentId
          stylingIssueType = "pull_resistor_on_wrong_side"
          message = `consider placing ${getReadableNameForElementId(circuitJson, schematicComponentId ?? "")} ${issue.preferredSide} ${getReadableNameForElementId(circuitJson, issue.hostSchematicBox.schematicComponentId ?? "")}.${getReadableNameForElementId(circuitJson, issue.signalSourcePortId)} so the pull-${issue.pullDirection} branch reads toward ${issue.pullDirection === "up" ? "power" : "ground"}`
          break
        case "VoltageDividerSupplyResistorBelowGroundResistor": {
          schematicComponentId =
            issue.supplyResistorSchematicBox.schematicComponentId
          const supplyResistorName = getReadableNameForElementId(
            circuitJson,
            schematicComponentId ?? "",
          )
          const groundResistorName = getReadableNameForElementId(
            circuitJson,
            issue.groundResistorSchematicBox.schematicComponentId ?? "",
          )
          stylingIssueType =
            "voltage_divider_supply_resistor_below_ground_resistor"
          message = `${supplyResistorName}, connected to the supply, is below ${groundResistorName}, connected to ground. Place ${supplyResistorName} above ${groundResistorName} so their shared divider tap is easy to follow. Preserve pin connections and reroute affected traces; exact alignment is not required.`
          break
        }
        case "SeriesLedChainNotOrdered": {
          schematicComponentId =
            issue.ledSchematicBoxes[0]?.schematicComponentId
          const ledNames = issue.ledSchematicBoxes
            .map((box) =>
              getReadableNameForElementId(
                circuitJson,
                box.schematicComponentId ?? "",
              ),
            )
            .join(", ")
          stylingIssueType = "series_led_chain_not_ordered"
          message = `The series chain ${ledNames} requires long connections behind LED pins. Arrange the LEDs in their connected order, preserving anode/cathode connections, and reroute affected traces. A horizontal, vertical, or clearly connected folded chain is acceptable.`
          break
        }
        case "ParallelRcNotAligned": {
          schematicComponentId = issue.resistorSchematicBox.schematicComponentId
          const resistorName = getReadableNameForElementId(
            circuitJson,
            schematicComponentId ?? "",
          )
          const capacitorName = getReadableNameForElementId(
            circuitJson,
            issue.capacitorSchematicBox.schematicComponentId ?? "",
          )
          stylingIssueType = "parallel_rc_not_aligned"
          message = `${resistorName} and ${capacitorName} share chip-pin and ground connections but are not drawn as adjacent parallel branches. Place their shared connections at matching ends, preserving pin connections and capacitor polarity, and reroute affected traces.`
          break
        }
        default:
          return []
      }
      if (!schematicComponentId) return []
      const component = db.schematic_component.get(schematicComponentId)
      if (!component) return []
      const group = component.schematic_group_id
        ? db.schematic_group.get(component.schematic_group_id)
        : undefined
      return [
        {
          type: "schematic_component_styling_warning",
          schematic_component_styling_warning_id: `schematic_component_styling_warning_${schematicComponentId}_${stylingIssueType}`,
          warning_type: "schematic_component_styling_warning",
          styling_issue_type: stylingIssueType,
          message,
          schematic_component_id: schematicComponentId,
          source_component_id: component.source_component_id,
          schematic_sheet_id: component.schematic_sheet_id,
          subcircuit_id: component.subcircuit_id ?? group?.subcircuit_id,
          schematic_port_ids: db.schematic_port
            .list()
            .filter(
              (port) => port.schematic_component_id === schematicComponentId,
            )
            .map((port) => port.schematic_port_id),
        },
      ]
    })
}
