import type { SourceComponentBase, SourcePort } from "circuit-json"

/**
 * Check each pin requirement independently. A chip with enough connectable pins
 * is checked unless every one explicitly declares that requirement absent.
 */
export const shouldCheckChipPowerGroundPins = (
  component: SourceComponentBase,
  ports: SourcePort[],
  requirement: "requires_power" | "requires_ground",
): boolean => {
  if (component.ftype !== "simple_chip") return false

  const connectablePorts = ports.filter((port) => port.do_not_connect !== true)
  return (
    connectablePorts.length >= 2 &&
    !connectablePorts.every((port) => port[requirement] === false)
  )
}
