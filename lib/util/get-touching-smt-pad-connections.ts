import type { AnyCircuitElement, PcbSmtPad } from "circuit-json"
import Flatbush from "flatbush"
import { getPadBounds, getPadToPadGap } from "../check-pad-clearance/common"

/** Connect source contacts sharing actual SMT copper on the same PCB layer. */
export function getTouchingSmtPadConnections(
  circuitJson: AnyCircuitElement[],
): string[][] {
  const pads = circuitJson.filter(
    (element): element is PcbSmtPad =>
      element.type === "pcb_smtpad" && Boolean(element.pcb_port_id),
  )
  if (pads.length < 2) return []

  const epsilon = 1e-9
  const bounds = pads.map(getPadBounds)
  const index = new Flatbush(pads.length)
  for (const box of bounds) index.add(box.minX, box.minY, box.maxX, box.maxY)
  index.finish()

  const connections: string[][] = []
  for (const [i, pad] of pads.entries()) {
    const box = bounds[i]
    for (const j of index.search(
      box.minX - epsilon,
      box.minY - epsilon,
      box.maxX + epsilon,
      box.maxY + epsilon,
    )) {
      const other = pads[j]
      if (
        j <= i ||
        pad.layer !== other.layer ||
        pad.pcb_port_id === other.pcb_port_id
      )
        continue
      // Bounds only select candidates: rotated/round pads must touch in copper.
      if (getPadToPadGap(pad, other) <= epsilon) {
        connections.push([pad.pcb_port_id!, other.pcb_port_id!])
      }
    }
  }
  return connections
}
