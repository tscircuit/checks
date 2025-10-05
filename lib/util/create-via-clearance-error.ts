import type {
  AnyCircuitElement,
  PcbVia,
  PcbViaClearanceError,
} from "circuit-json"
import { getReadableNameForElement } from "@tscircuit/circuit-json-util"

export function createViaClearanceError(
  viaA: PcbVia,
  viaB: PcbVia,
  gap: number,
  minSpacing: number,
  circuitJson: AnyCircuitElement[],
  netType: "same" | "different",
): PcbViaClearanceError {
  const [via1Id, via2Id] = [viaA.pcb_via_id, viaB.pcb_via_id].sort()
  const name1 = getReadableNameForElement(circuitJson, viaA.pcb_via_id)
  const name2 = getReadableNameForElement(circuitJson, viaB.pcb_via_id)
  const midX = (viaA.x + viaB.x) * 0.5
  const midY = (viaA.y + viaB.y) * 0.5
  const netDesc = netType === "different" ? "Different-net" : "Same-net"

  const error: PcbViaClearanceError = {
    type: "pcb_via_clearance_error",
    pcb_error_id: `pcb_error_via_clearance_${netType}_net_${via1Id}_${via2Id}`,
    error_type: "pcb_via_clearance_error",
    message: `${netDesc} vias ${name1} and ${name2} must have at least ${minSpacing.toFixed(3)}mm clearance but currently have ${gap.toFixed(3)}mm clearance.`,
    pcb_via_ids: [via1Id, via2Id],
    minimum_clearance: minSpacing,
    actual_clearance: gap,
  }

  if (Number.isFinite(midX) && Number.isFinite(midY)) {
    error.pcb_center = { x: midX, y: midY }
  }

  const subcircuitId = viaA.subcircuit_id || viaB.subcircuit_id
  if (subcircuitId) {
    error.subcircuit_id = subcircuitId
  }

  return error
}
