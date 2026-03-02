import type { PcbVia } from "circuit-json"
import { distance } from "./distance"
import { EPSILON } from "lib/drc-defaults"

export function viasAreAtSameLocation(a: PcbVia, b: PcbVia): boolean {
  return distance(a, b) <= EPSILON
}
