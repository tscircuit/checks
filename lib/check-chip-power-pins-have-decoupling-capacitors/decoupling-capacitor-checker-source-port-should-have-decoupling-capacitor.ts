import type { SourcePort } from "circuit-json"

export const sourcePortShouldHaveDecouplingCapacitor = (
  sourcePort: SourcePort,
): boolean => {
  if (sourcePort.should_have_decoupling_capacitor !== undefined) {
    return sourcePort.should_have_decoupling_capacitor
  }
  return (
    sourcePort.requires_power === true && sourcePort.provides_power !== true
  )
}
