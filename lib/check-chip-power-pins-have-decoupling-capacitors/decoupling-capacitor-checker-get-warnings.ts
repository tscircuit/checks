import type { SourcePinMissingTraceWarning } from "circuit-json"
import type { DecouplingCapacitorChecker } from "./decoupling-capacitor-checker"
import { getSourcePortDisplayLabel } from "./get-source-port-display-label"

export const getDecouplingCapacitorWarnings = (
  checker: DecouplingCapacitorChecker,
): SourcePinMissingTraceWarning[] => {
  const warnings: SourcePinMissingTraceWarning[] = []

  for (const chipSourceComponent of checker.sourceComponents) {
    if (chipSourceComponent.ftype !== "simple_chip") continue

    for (const chipSourcePort of checker.getSourcePorts(
      chipSourceComponent.source_component_id,
    )) {
      if (!checker.sourcePortShouldHaveDecouplingCapacitor(chipSourcePort)) {
        continue
      }
      if (!checker.sourcePortHasConnection(chipSourcePort)) continue

      const hasDecouplingCapacitor = checker.capacitorSourceComponents.some(
        (capacitorSourceComponent) =>
          checker.capacitorConnectsPowerSourcePortToGround(
            capacitorSourceComponent,
            chipSourcePort,
          ),
      )
      if (hasDecouplingCapacitor) continue

      const recommendedCapacitance =
        chipSourcePort.recommended_decoupling_capacitor_capacitance
      const capacitanceDescription =
        recommendedCapacitance === undefined ? "" : ` ${recommendedCapacitance}`

      warnings.push({
        type: "source_pin_missing_trace_warning",
        source_pin_missing_trace_warning_id: `source_pin_missing_trace_warning_decoupling_${chipSourcePort.source_port_id}`,
        warning_type: "source_pin_missing_trace_warning",
        message: `Power pin ${getSourcePortDisplayLabel(chipSourcePort)} on ${chipSourceComponent.name} should have a${capacitanceDescription} decoupling capacitor connected to ground`,
        source_component_id: chipSourceComponent.source_component_id,
        source_port_id: chipSourcePort.source_port_id,
        subcircuit_id: chipSourcePort.subcircuit_id,
      })
    }
  }

  return warnings
}
