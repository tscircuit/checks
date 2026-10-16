import { convertCircuitJsonToFlattenJs } from "@tscircuit/circuit-json-to-flattenjs"
import type {
  AnyCircuitElement,
  PcbKeepoutOverlapWarning,
  PcbPlacementError,
} from "circuit-json"
import { createCopperPolygonContactTester } from "./copper-pour-connectivity/create-copper-polygon-contact-tester"
import { EPSILON } from "./drc-defaults"

/**
 * Checks finished copper-pour geometry against PCB keepouts.
 *
 * Trace and placement permissions do not permit pours through a keepout:
 * pours are finished copper regions and remain excluded by the keepout.
 */
export function checkCopperPoursOverKeepout(
  circuitJson: AnyCircuitElement[],
): (PcbPlacementError | PcbKeepoutOverlapWarning)[] {
  if (
    !circuitJson.some((element) => element.type === "pcb_keepout") ||
    !circuitJson.some((element) => element.type === "pcb_copper_pour")
  ) {
    return []
  }

  const { elements } = convertCircuitJsonToFlattenJs(circuitJson, {
    elementTypes: ["pcb_keepout", "pcb_copper_pour"],
    strict: true,
  })
  const keepouts = elements.filter(
    (element) => element.elementType === "pcb_keepout",
  )
  const polygonsTouch = createCopperPolygonContactTester(EPSILON)
  const errors = new Map<
    string,
    PcbPlacementError | PcbKeepoutOverlapWarning
  >()

  for (const pourGeometry of elements) {
    const pour = pourGeometry.sourceElement
    if (pour.type !== "pcb_copper_pour") continue

    for (const keepoutGeometry of keepouts) {
      const keepout = keepoutGeometry.sourceElement
      if (
        keepout.type !== "pcb_keepout" ||
        keepoutGeometry.layer !== pourGeometry.layer
      ) {
        continue
      }

      const overlaps = pourGeometry.shapes.some((pourShape) =>
        keepoutGeometry.shapes.some((keepoutShape) =>
          polygonsTouch(pourShape, keepoutShape),
        ),
      )
      if (!overlaps) continue

      const errorId =
        `copper_pour_over_keepout_${pour.pcb_copper_pour_id}_${keepout.pcb_keepout_id}`
      if (errors.has(errorId)) continue

      const message =
        `Copper pour ${pour.pcb_copper_pour_id} overlaps ` +
        `${keepout.warning_only ? "advisory " : ""}PCB keepout ` +
        `"${keepout.description ?? keepout.pcb_keepout_id}" on ${pourGeometry.layer}`
      const subcircuit_id = pour.subcircuit_id ?? keepout.subcircuit_id

      if (keepout.warning_only) {
        errors.set(errorId, {
          type: "pcb_keepout_overlap_warning",
          warning_type: "pcb_keepout_overlap_warning",
          pcb_keepout_overlap_warning_id:
            `pcb_keepout_overlap_warning_${errorId}`,
          pcb_keepout_id: keepout.pcb_keepout_id,
          message,
          subcircuit_id,
        })
      } else {
        errors.set(errorId, {
          type: "pcb_placement_error",
          error_type: "pcb_placement_error",
          pcb_placement_error_id: errorId,
          message,
          subcircuit_id,
        })
      }
    }
  }

  return [...errors.values()]
}
