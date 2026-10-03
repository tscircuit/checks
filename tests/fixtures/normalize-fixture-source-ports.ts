import {
  source_port,
  type AnyCircuitElement,
  type SourcePort,
} from "circuit-json"

type LegacySourcePort = Omit<
  SourcePort,
  "provides_voltage" | "requires_voltage"
> & {
  provides_voltage?: number | string
  requires_voltage?: number | string
}
type FixtureElement = Exclude<AnyCircuitElement, SourcePort> | LegacySourcePort

/** Pinned visual fixture generators predate normalized source-port voltage
 * output. Parse those records at the current JSON boundary, preserving all
 * geometry and the existing routing/snapshot versions. */
export function normalizeFixtureSourcePorts(
  elements: readonly FixtureElement[],
): AnyCircuitElement[] {
  return elements.map((element) =>
    element.type === "source_port" ? source_port.parse(element) : element,
  )
}
