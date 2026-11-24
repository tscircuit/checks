import { getReadableNameForElementId } from "lib/util/get-readable-names"
import type {
  AnyCircuitElement,
  PCBKeepout,
  PcbPlacementError,
  PcbKeepoutOverlapWarning,
} from "circuit-json"
import { getPadToPadGap } from "./check-pad-clearance/common"
import { EPSILON } from "./drc-defaults"
import { courtyardToKeepout } from "./util/courtyard-to-keepout"
import { getPlacementEnvelopes } from "./util/get-placement-envelopes"

/** Check component placement envelopes even when their copper clears a keepout. */
export function checkPcbCourtyardOverKeepout(
  circuitJson: AnyCircuitElement[],
): (PcbPlacementError | PcbKeepoutOverlapWarning)[] {
  const keepouts = circuitJson.filter(
    (el): el is PCBKeepout => el.type === "pcb_keepout" && !el.allow_placements,
  )
  const components = new Map(
    circuitJson.flatMap((el) =>
      el.type === "pcb_component" ? [[el.pcb_component_id, el] as const] : [],
    ),
  )

  const courtyards = getPlacementEnvelopes(circuitJson)
  const errors = new Map<string, PcbPlacementError | PcbKeepoutOverlapWarning>()
  for (const courtyard of courtyards) {
    const componentId = courtyard.pcb_component_id
    const component = components.get(componentId)
    if (component?.do_not_place) continue
    const geometry = courtyardToKeepout(courtyard)
    const label = courtyard.usesComponentBounds ? "Bounds" : "Courtyard"
    const verb = courtyard.usesComponentBounds ? "overlap" : "overlaps"
    for (const keepout of keepouts) {
      if (!keepout.layers.includes(courtyard.layer)) continue
      if (keepout.excluded_pcb_component_ids?.includes(componentId)) continue
      const id = `courtyard_over_keepout_${componentId}_${keepout.pcb_keepout_id}`
      if (errors.has(id)) continue
      if (getPadToPadGap(geometry, keepout) > EPSILON) continue
      const name = getReadableNameForElementId(circuitJson, componentId)
      const description = getReadableNameForElementId(
        circuitJson,
        keepout.pcb_keepout_id,
      )
      const subcircuit_id = component?.subcircuit_id ?? keepout.subcircuit_id
      if (keepout.warning_only) {
        errors.set(id, {
          type: "pcb_keepout_overlap_warning",
          warning_type: "pcb_keepout_overlap_warning",
          pcb_keepout_overlap_warning_id: `pcb_keepout_overlap_warning_${id}`,
          pcb_keepout_id: keepout.pcb_keepout_id,
          pcb_component_ids: [componentId],
          message: `${label} of ${name} ${verb} advisory PCB keepout "${description}"`,
          subcircuit_id,
        })
      } else {
        errors.set(id, {
          type: "pcb_placement_error",
          error_type: "pcb_placement_error",
          pcb_placement_error_id: id,
          message: `${label} of ${name} ${verb} PCB keepout "${description}"`,
          subcircuit_id,
        })
      }
    }
  }
  return [...errors.values()]
}
