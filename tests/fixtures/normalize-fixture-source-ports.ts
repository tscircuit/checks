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

function normalizeSourcePorts(
  elements: FixtureElement[],
): asserts elements is AnyCircuitElement[] {
  for (const element of elements) {
    if (element.type === "source_port")
      Object.assign(element, source_port.parse(element))
  }
}

/** Pinned visual fixture generators predate normalized source-port voltage
 * output. Parse those records at the current JSON boundary, preserving all
 * geometry and the live array used when fixtures insert later annotations. */
export function normalizeFixtureSourcePorts(
  elements: FixtureElement[],
): AnyCircuitElement[] {
  normalizeSourcePorts(elements)
  return elements
}
