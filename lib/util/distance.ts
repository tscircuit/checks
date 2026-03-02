import type { PcbVia } from "circuit-json"

export function distance(a: PcbVia, b: PcbVia): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
