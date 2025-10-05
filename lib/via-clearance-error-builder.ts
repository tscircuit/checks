import type {
  PcbVia,
  PcbViaClearanceError,
  AnyCircuitElement,
} from "circuit-json"
import { getReadableNameForElement } from "@tscircuit/circuit-json-util"

export class ViaClearanceErrorBuilder {
  private vias: [PcbVia, PcbVia]
  private clearanceValue: number
  private requiredSpacing: number
  private elements: AnyCircuitElement[]
  private netCategory: "same" | "different"

  constructor(
    via1: PcbVia,
    via2: PcbVia,
    actualClearance: number,
    minimumSpacing: number,
    circuitElements: AnyCircuitElement[],
    netType: "same" | "different",
  ) {
    this.vias = [via1, via2]
    this.clearanceValue = actualClearance
    this.requiredSpacing = minimumSpacing
    this.elements = circuitElements
    this.netCategory = netType
  }

  private getViaIds(): string[] {
    return [this.vias[0].pcb_via_id, this.vias[1].pcb_via_id].sort()
  }

  private getErrorId(): string {
    const ids = this.getViaIds()
    return `pcb_error_via_clearance_${this.netCategory}_net_${ids.join("_")}`
  }

  private getMessage(): string {
    const [via1, via2] = this.vias
    const name1 = getReadableNameForElement(this.elements, via1.pcb_via_id)
    const name2 = getReadableNameForElement(this.elements, via2.pcb_via_id)
    const netDesc =
      this.netCategory === "different" ? "Different-net" : "Same-net"

    return `${netDesc} vias ${name1} and ${name2} must have at least ${this.requiredSpacing.toFixed(3)}mm clearance but currently have ${this.clearanceValue.toFixed(3)}mm clearance.`
  }

  private getCenter(): { x: number; y: number } | undefined {
    const [via1, via2] = this.vias
    const midX = (via1.x + via2.x) * 0.5
    const midY = (via1.y + via2.y) * 0.5

    if (!Number.isFinite(midX) || !Number.isFinite(midY)) {
      return undefined
    }

    return { x: midX, y: midY }
  }

  private getSubcircuitId(): string | undefined {
    return this.vias[0].subcircuit_id || this.vias[1].subcircuit_id
  }

  build(): PcbViaClearanceError {
    const error: PcbViaClearanceError = {
      type: "pcb_via_clearance_error",
      pcb_error_id: this.getErrorId(),
      error_type: "pcb_via_clearance_error",
      message: this.getMessage(),
      pcb_via_ids: this.getViaIds(),
      minimum_clearance: this.requiredSpacing,
      actual_clearance: this.clearanceValue,
    }

    const center = this.getCenter()
    if (center) {
      error.pcb_center = center
    }

    const subcircuitId = this.getSubcircuitId()
    if (subcircuitId) {
      error.subcircuit_id = subcircuitId
    }

    return error
  }
}
