import { analyzeSchematicPlacement } from "@tscircuit/circuit-json-schematic-placement-analysis/analysis"
import { cju } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  SchematicComponentStylingWarning,
} from "circuit-json"
import { getReadableNameForElementId } from "lib/util/get-readable-names"
import { getSchematicAnnotationComponentIds } from "lib/util/get-schematic-annotation-component-ids"

// Enable reviewed placement findings individually as schematic warnings.
const enabledIssueTypes = [
  "TwoPinComponentHasInvertedRails",
  "RegulatorCapacitorsOnWrongSides",
  "PullResistorOnWrongSide",
  "VoltageDividerSupplyResistorBelowGroundResistor",
  "SeriesLedChainNotOrdered",
  "ParallelRcNotAligned",
  "ComponentOverlap",
  "SchematicTextCollision",
  "TraceCanBeSimplifiedByMovingComponent",
  "ConnectorPositionCausesTraceDetours",
  "NetLabelCollision",
  "ComponentBranchesOutOfOrder",
  "CrystalNotCenteredOverLoadCapacitors",
] as const

export function isCrystalComponent(
  sourceComponent?: AnyCircuitElement | null,
): boolean {
  if (!sourceComponent || sourceComponent.type !== "source_component") {
    return false
  }

  // Explicit crystal or resonator ftype
  if ("ftype" in sourceComponent) {
    const ftype = (sourceComponent as any).ftype
    if (
      ftype === "simple_crystal" ||
      ftype === "simple_resonator" ||
      ftype === "crystal" ||
      ftype === "resonator"
    ) {
      return true
    }
  }

  // Explicit role
  if (
    "role" in sourceComponent &&
    typeof sourceComponent.role === "string" &&
    (sourceComponent.role === "crystal" ||
      sourceComponent.role === "resonator" ||
      sourceComponent.role === "oscillator")
  ) {
    return true
  }

  // Explicit symbol_name
  if (
    "symbol_name" in sourceComponent &&
    typeof sourceComponent.symbol_name === "string" &&
    /crystal|resonator|oscillator/i.test(sourceComponent.symbol_name)
  ) {
    return true
  }

  // Explicit description
  if (
    "description" in sourceComponent &&
    typeof sourceComponent.description === "string" &&
    /crystal|resonator|oscillator/i.test(sourceComponent.description)
  ) {
    return true
  }

  const name =
    typeof sourceComponent.name === "string" ? sourceComponent.name : ""
  const mpn =
    "manufacturer_part_number" in sourceComponent &&
    typeof sourceComponent.manufacturer_part_number === "string"
      ? sourceComponent.manufacturer_part_number
      : ""
  const supplierParts =
    "supplier_part_numbers" in sourceComponent &&
    sourceComponent.supplier_part_numbers &&
    typeof sourceComponent.supplier_part_numbers === "object"
      ? Object.values(sourceComponent.supplier_part_numbers).flat().join(" ")
      : ""
  const combined = `${name} ${mpn} ${supplierParts}`

  // Ferrite beads, inductors, resistors, capacitors, chips, etc. are NOT crystals
  if (/MH1608|ferrite|bead|inductor/i.test(combined)) {
    return false
  }

  if (/^(L|FB|R|C|D|U|J|P|TP)\d*$/i.test(name)) {
    return false
  }

  // Reference designators commonly indicating crystals / resonators
  if (/^(Y|XTAL|OSC)\d*$/i.test(name)) {
    return true
  }

  if (/^X\d+$/i.test(name) && !/connector|header/i.test(combined)) {
    return true
  }

  return false
}

export function checkSchematicPlacement(
  circuitJson: AnyCircuitElement[],
): SchematicComponentStylingWarning[] {
  const analysis = analyzeSchematicPlacement(circuitJson, {
    issueTypes: enabledIssueTypes,
  })
  const db = cju(circuitJson)
  const createWarning = ({
    schematicComponentId,
    stylingIssueType,
    message,
    suffix = "",
  }: {
    schematicComponentId?: string
    stylingIssueType: string
    message: string
    suffix?: string
  }): SchematicComponentStylingWarning[] => {
    if (!schematicComponentId) return []
    const component = db.schematic_component.get(schematicComponentId)
    if (!component) return []
    const group = component.schematic_group_id
      ? db.schematic_group.get(component.schematic_group_id)
      : undefined
    return [
      {
        type: "schematic_component_styling_warning",
        schematic_component_styling_warning_id: `schematic_component_styling_warning_${schematicComponentId}_${stylingIssueType}${suffix}`,
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
  }
  return analysis
    .getIssues()
    .flatMap((issue): SchematicComponentStylingWarning[] => {
      let schematicComponentId: string | undefined
      let stylingIssueType: string
      let message: string
      switch (issue.lineItemType) {
        case "NetLabelCollision":
          // This analyzer emits one aggregate per sheet, with component names.
          // Resolve only unambiguous names on that sheet, never across sheets.
          return issue.pairs.flatMap((pair) => {
            const first = db.schematic_component
              .list()
              .filter(
                (p) =>
                  p.schematic_sheet_id === issue.schematicSheetId &&
                  (db.source_component.get(p.source_component_id ?? "")?.name ??
                    "") === pair.comp1Name,
              )
            const second = db.schematic_component
              .list()
              .filter(
                (p) =>
                  p.schematic_sheet_id === issue.schematicSheetId &&
                  (db.source_component.get(p.source_component_id ?? "")?.name ??
                    "") === pair.comp2Name,
              )
            if (first.length !== 1 || second.length !== 1) return []
            const firstId = first[0]!.schematic_component_id
            const secondId = second[0]!.schematic_component_id
            if (!firstId || !secondId || firstId === secondId) return []
            const firstName = getReadableNameForElementId(circuitJson, firstId)
            const secondName = getReadableNameForElementId(
              circuitJson,
              secondId,
            )
            return createWarning({
              schematicComponentId: firstId,
              stylingIssueType: "net_label_collision",
              suffix: `_${secondId}`,
              message: `Net labels attached to ${firstName} or ${secondName} overlap the other component or its labels. Separate the components and their attached labels, preserving pin connections and rerouting affected traces.`,
            })
          })
        case "ComponentBranchesOutOfOrder": {
          const hostId = issue.hostSchematicBox.schematicComponentId
          const hostName = getReadableNameForElementId(
            circuitJson,
            hostId ?? "",
          )
          const firstId = issue.firstComponentSchematicBox.schematicComponentId
          const secondId =
            issue.secondComponentSchematicBox.schematicComponentId
          const firstName = getReadableNameForElementId(
            circuitJson,
            firstId ?? "",
          )
          const secondName = getReadableNameForElementId(
            circuitJson,
            secondId ?? "",
          )
          return createWarning({
            schematicComponentId: hostId,
            stylingIssueType: "component_branches_out_of_order",
            suffix: `_${firstId}_${secondId}`,
            message: `Reorder ${firstName} and ${secondName} to follow their connected pins on ${hostName}, avoiding crossed wires. Preserve component symbols, pin assignments and polarity; leave room for labels and reroute both branches without moving the host pins.`,
          })
        }
        case "TraceCanBeSimplifiedByMovingComponent": {
          const targetId = issue.targetComponent.schematicComponentId
          const componentName = getReadableNameForElementId(
            circuitJson,
            targetId ?? "",
          )
          return createWarning({
            schematicComponentId: targetId,
            stylingIssueType: "trace_can_be_simplified_by_moving_component",
            suffix: `_${issue.schematicTraceId}`,
            message: `Move ${componentName} to schX=${issue.newSchX}, schY=${issue.newSchY} to reduce the connected trace from ${issue.currentTurnCount} turns to ${issue.suggestedTurnCount}. Preserve pin connections and reroute attached traces.`,
          })
        }
        case "ConnectorPositionCausesTraceDetours": {
          const connectorId = issue.connectorSchematicBox.schematicComponentId
          const connectorName = getReadableNameForElementId(
            circuitJson,
            connectorId ?? "",
          )
          const connectedNames = issue.connectedComponents
            .map((box) =>
              getReadableNameForElementId(
                circuitJson,
                box.schematicComponentId ?? "",
              ),
            )
            .join(", ")
          return createWarning({
            schematicComponentId: connectorId,
            stylingIssueType: "connector_position_causes_trace_detours",
            message: `Move ${connectorName} to schX=${issue.newSchX}, schY=${issue.newSchY} so its signal pins face ${connectedNames}. Preserve rotation, pin assignments and electrical connections, and reroute attached traces and rail labels.`,
          })
        }
        case "ComponentOverlap": {
          const firstId = issue.firstComponent.schematicComponentId
          const secondId = issue.secondComponent.schematicComponentId
          if (!firstId || !secondId) return []
          return createWarning({
            schematicComponentId: firstId,
            stylingIssueType: "component_overlap",
            suffix: `_${secondId}`,
            message: `${getReadableNameForElementId(circuitJson, firstId)} overlaps ${getReadableNameForElementId(circuitJson, secondId)}. Separate their schematic bodies, preserving pin connections and rerouting attached traces.`,
          })
        }
        case "SchematicTextCollision": {
          const componentIds = new Set([
            ...getSchematicAnnotationComponentIds(
              circuitJson,
              issue.schematicTextId,
            ),
            ...getSchematicAnnotationComponentIds(
              circuitJson,
              issue.collidingObject.id,
            ),
          ])
          const textName = getReadableNameForElementId(
            circuitJson,
            issue.schematicTextId,
          )
          const targetName =
            issue.collidingObject.type === "trace"
              ? "a trace"
              : getReadableNameForElementId(
                  circuitJson,
                  issue.collidingObject.id,
                )
          // Component styling warnings require an actual component association.
          // Standalone text-only collisions remain available in the analyzer.
          return [...componentIds].flatMap((id) =>
            createWarning({
              schematicComponentId: id,
              stylingIssueType: "schematic_text_collision",
              suffix: `_${issue.schematicTextId}_${issue.collidingObject.id}`,
              message: `Text "${textName}" overlaps ${targetName}. Reposition the text or adjust its owning trace's label placement to leave the visible text area clear.`,
            }),
          )
        }
        case "TwoPinComponentHasInvertedRails": {
          schematicComponentId = issue.schematicBox.schematicComponentId
          const componentName = getReadableNameForElementId(
            circuitJson,
            schematicComponentId ?? "",
          )
          stylingIssueType = "inverted_rails"
          message =
            issue.railType === "ground"
              ? `${componentName} has its ground pin facing up. Rotate ${componentName} by 180° so that pin faces down, preserving pin connections, and reroute attached traces.`
              : `${componentName} has its positive-supply pin facing down. Rotate ${componentName} by 180° so that pin faces up, preserving pin connections, and reroute attached traces.`
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
        case "CrystalNotCenteredOverLoadCapacitors": {
          schematicComponentId = issue.crystalSchematicBox.schematicComponentId
          const sourceComponentId = issue.crystalSchematicBox.sourceComponentId
          const sourceComponent = sourceComponentId
            ? db.source_component.get(sourceComponentId)
            : undefined

          if (!isCrystalComponent(sourceComponent)) {
            return []
          }

          const crystalName = getReadableNameForElementId(
            circuitJson,
            schematicComponentId ?? "",
          )
          const firstCapacitorName = getReadableNameForElementId(
            circuitJson,
            issue.firstLoadCapacitorSchematicBox.schematicComponentId ?? "",
          )
          const secondCapacitorName = getReadableNameForElementId(
            circuitJson,
            issue.secondLoadCapacitorSchematicBox.schematicComponentId ?? "",
          )
          stylingIssueType = "crystal_not_centered_over_load_capacitors"
          message = `${crystalName} is not centered between load capacitors ${firstCapacitorName} and ${secondCapacitorName}. Move ${crystalName} so it is centered between them and aligned with their load-side pins.`
          break
        }
        default:
          return []
      }
      return createWarning({ schematicComponentId, stylingIssueType, message })
    })
}
