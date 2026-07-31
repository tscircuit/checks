import type { SourcePort } from "circuit-json"

const sourcePortLabelIsGenericPinName = (sourcePortLabel: string): boolean => {
  const normalizedSourcePortLabel = sourcePortLabel.trim().toLowerCase()
  const possiblePinNumber = normalizedSourcePortLabel.startsWith("pin")
    ? normalizedSourcePortLabel.slice(3)
    : normalizedSourcePortLabel
  return (
    possiblePinNumber.length > 0 &&
    [...possiblePinNumber].every(
      (character) => character >= "0" && character <= "9",
    )
  )
}

export const getSourcePortDisplayLabel = (sourcePort: SourcePort): string =>
  sourcePort.port_hints?.find(
    (sourcePortHint) => !sourcePortLabelIsGenericPinName(sourcePortHint),
  ) ?? sourcePort.name
