import type { SourceComponentBase, SourcePort } from "circuit-json"

/**
 * Power and ground pin-role checks only apply when a chip exposes enough
 * connectable pins to define both roles. One-port passives such as chip
 * antennas can have additional package pads explicitly marked do-not-connect,
 * but cannot truthfully declare power and ground pins.
 */
export const shouldCheckChipPowerGroundPins = (
  component: SourceComponentBase,
  ports: SourcePort[],
): boolean =>
  component.ftype === "simple_chip" &&
  ports.filter((port) => port.do_not_connect !== true).length >= 2
