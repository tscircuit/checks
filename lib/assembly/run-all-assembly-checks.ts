import type { AnyCircuitElement } from "circuit-json"
import type { CheckOptions } from "./assembly-geometry"
import { checkEnclosureApertureIntersections } from "./check-enclosure-aperture-intersections"

export async function runAllAssemblyChecks(
  circuitJson: AnyCircuitElement[],
  options: CheckOptions = {},
) {
  return checkEnclosureApertureIntersections(circuitJson, options)
}
