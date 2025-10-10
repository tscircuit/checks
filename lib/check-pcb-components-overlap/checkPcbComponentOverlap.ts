import type {
  AnyCircuitElement,
  PcbFootprintOverlapError,
  PcbSmtPad,
  PcbPlatedHole,
  PcbHole,
} from "circuit-json"
import {
  cju,
  getBoundsOfPcbElements,
  getPrimaryId,
} from "@tscircuit/circuit-json-util"
import { doBoundsOverlap } from "@tscircuit/math-utils"
import {
  getFullConnectivityMapFromCircuitJson,
  type ConnectivityMap,
} from "circuit-json-to-connectivity-map"

type OverlappableElement = PcbSmtPad | PcbPlatedHole | PcbHole

/**
 * Check for overlapping PCB components
 * Returns errors for components that overlap inappropriately
 */
export function checkPcbComponentOverlap(
  circuitJson: AnyCircuitElement[],
): PcbFootprintOverlapError[] {
  const errors: PcbFootprintOverlapError[] = []

  // Build connectivity map to check if components are electrically connected
  const connMap = getFullConnectivityMapFromCircuitJson(circuitJson)

  // Get all overlappable elements
  const smtPads = cju(circuitJson).pcb_smtpad.list()
  const platedHoles = cju(circuitJson).pcb_plated_hole.list()
  const holes = cju(circuitJson).pcb_hole.list()

  const allElements: OverlappableElement[] = [
    ...smtPads,
    ...platedHoles,
    ...holes,
  ]

  // Check all pairs for overlaps
  for (let i = 0; i < allElements.length; i++) {
    for (let j = i + 1; j < allElements.length; j++) {
      const elem1 = allElements[i]
      const elem2 = allElements[j]

      const id1 = getPrimaryId(elem1)
      const id2 = getPrimaryId(elem2)

      // Check if both are SMT pads and are electrically connected (same net) - if so, skip
      // This allows pads with the same subcircuit connectivity to be in contact
      if (
        elem1.type === "pcb_smtpad" &&
        elem2.type === "pcb_smtpad" &&
        connMap.areIdsConnected(id1, id2)
      ) {
        continue
      }

      // Check if bounds overlap using circuit-json-util
      const bounds1 = getBoundsOfPcbElements([elem1])
      const bounds2 = getBoundsOfPcbElements([elem2])

      if (doBoundsOverlap(bounds1, bounds2)) {
        // Create error object
        const error: PcbFootprintOverlapError = {
          type: "pcb_footprint_overlap_error",
          pcb_error_id: `pcb_footprint_overlap_${id1}_${id2}`,
          error_type: "pcb_footprint_overlap_error",
          message: `PCB component ${elem1.type} "${id1}" overlaps with ${elem2.type} "${id2}"`,
        }

        // Add relevant IDs based on element types
        if (elem1.type === "pcb_smtpad" || elem2.type === "pcb_smtpad") {
          error.pcb_smtpad_ids = []
          if (elem1.type === "pcb_smtpad") error.pcb_smtpad_ids.push(id1)
          if (elem2.type === "pcb_smtpad") error.pcb_smtpad_ids.push(id2)
        }

        if (
          elem1.type === "pcb_plated_hole" ||
          elem2.type === "pcb_plated_hole"
        ) {
          error.pcb_plated_hole_ids = []
          if (elem1.type === "pcb_plated_hole")
            error.pcb_plated_hole_ids.push(id1)
          if (elem2.type === "pcb_plated_hole")
            error.pcb_plated_hole_ids.push(id2)
        }

        if (elem1.type === "pcb_hole" || elem2.type === "pcb_hole") {
          error.pcb_hole_ids = []
          if (elem1.type === "pcb_hole") error.pcb_hole_ids.push(id1)
          if (elem2.type === "pcb_hole") error.pcb_hole_ids.push(id2)
        }

        errors.push(error)
      }
    }
  }

  return errors
}
