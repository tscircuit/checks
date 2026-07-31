import type {
  AnyCircuitElement,
  SourcePinMissingTraceWarning,
} from "circuit-json"
import { DecouplingCapacitorChecker } from "./check-chip-power-pins-have-decoupling-capacitors/decoupling-capacitor-checker"

export const checkChipPowerPinsHaveDecouplingCapacitors = (
  circuitJson: AnyCircuitElement[],
): SourcePinMissingTraceWarning[] =>
  new DecouplingCapacitorChecker(circuitJson).getWarnings()
