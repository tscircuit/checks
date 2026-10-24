import type { SourceComponentBase, SourcePort } from "circuit-json"

const isGroundPort = (port: SourcePort) =>
  port.requires_ground === true || port.provides_ground === true

/**
 * Power and ground pin-role checks only apply when a chip exposes enough
 * connectable pins to define both roles. One-port passives such as chip
 * antennas can have additional package pads explicitly marked do-not-connect,
 * but cannot truthfully declare power and ground pins.
 *
 * A chip whose connected pins are all passive, such as a diode pair, has no
 * supply pin and no ground pin. A chip whose connected pins are passive apart
 * from its ground pins, such as a TVS array, has no supply pin.
 */
export const shouldCheckChipPowerGroundPins = (
  component: SourceComponentBase,
  ports: SourcePort[],
  role: "power" | "ground",
): boolean => {
  if (component.ftype !== "simple_chip") return false
  const connected = ports.filter((port) => port.do_not_connect !== true)
  if (connected.length < 2) return false
  return connected.some(
    (port) =>
      port.is_passive !== true && (role === "ground" || !isGroundPort(port)),
  )
}
