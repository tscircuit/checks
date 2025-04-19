import type { Collidable } from "lib/check-each-pcb-trace-non-overlapping/getCollidableBounds"

export function getLayersOfPcbElement(obj: Collidable): string[] {
  if (obj.type === "pcb_trace_segment") {
    return [obj.layer]
  }
  if (obj.type === "pcb_smtpad") {
    return [obj.layer]
  }
  if (obj.type === "pcb_plated_hole") {
    return Array.isArray(obj.layers) ? obj.layers : ["top", "bottom"]
  }
  if (obj.type === "pcb_hole") {
    return ["top", "bottom"]
  }
  if (obj.type === "pcb_via") {
    return Array.isArray(obj.layers) ? obj.layers : ["top", "bottom"]
  }
  if (obj.type === "pcb_keepout") {
    return Array.isArray(obj.layers) ? obj.layers : []
  }
  return []
}
