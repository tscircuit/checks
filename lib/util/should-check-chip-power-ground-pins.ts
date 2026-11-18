import type { SourceComponentBase, SourcePort } from "circuit-json"

const mosfetTerminalAliases = [
  ["g", "gate"],
  ["s", "source"],
  ["d", "drain"],
]

const isImportedDiscreteMosfet = (
  component: SourceComponentBase,
  connectablePorts: SourcePort[],
): boolean => {
  if (
    !/^Q(?:[0-9_]|$)/i.test(component.name ?? "") ||
    connectablePorts.length !== mosfetTerminalAliases.length
  ) {
    return false
  }

  const portsByTerminal = mosfetTerminalAliases.map((aliases) =>
    connectablePorts.filter((port) =>
      [port.name, ...(port.port_hints ?? [])].some((label) =>
        aliases.includes(label.toLowerCase()),
      ),
    ),
  )

  return (
    portsByTerminal.every((ports) => ports.length === 1) &&
    new Set(portsByTerminal.flat()).size === mosfetTerminalAliases.length
  )
}

/**
 * Power and ground pin-role checks only apply when a chip exposes enough
 * connectable pins to define both roles. One-port passives such as chip
 * antennas can have additional package pads explicitly marked do-not-connect.
 * Discrete MOSFET imports use simple_chip with gate, source, and drain pins.
 */
export const shouldCheckChipPowerGroundPins = (
  component: SourceComponentBase,
  ports: SourcePort[],
): boolean => {
  if (component.ftype !== "simple_chip") return false

  const connectablePorts = ports.filter((port) => port.do_not_connect !== true)
  return (
    connectablePorts.length >= 2 &&
    !isImportedDiscreteMosfet(component, connectablePorts)
  )
}
