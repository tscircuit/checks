import type { SourceComponentBase, SourcePort } from "circuit-json"

/**
 * Power and ground pin-role checks only apply when a chip exposes enough
 * connectable pins to define both roles. One-port passives such as chip
 * antennas can have additional package pads explicitly marked do-not-connect,
 * and multi-port passives such as rotary encoders mark every connectable pin
 * with is_passive, so neither can truthfully declare power and ground pins.
 */
export const shouldCheckChipPowerGroundPins = (
  component: SourceComponentBase,
  ports: SourcePort[],
): boolean => {
  if (component.ftype !== "simple_chip") return false
  const connectablePorts = ports.filter((port) => port.do_not_connect !== true)
  return (
    connectablePorts.length >= 2 &&
    connectablePorts.some((port) => port.is_passive !== true)
  )
}
