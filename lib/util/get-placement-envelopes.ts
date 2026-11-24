import type { AnyCircuitElement } from "circuit-json"
import { checkPcbComponentsMissingCourtyard } from "../check-pcb-components-missing-courtyard"
import type { CourtyardElement } from "./courtyard-to-keepout"

export type PlacementEnvelope = CourtyardElement & {
  usesComponentBounds?: boolean
}

/** Explicit courtyards are authoritative; otherwise use the component's world AABB.
 * Bounds are only a fallback: they cannot supply missing body/assembly clearance.
 * Keep the missing-courtyard warning so consumers can require complete geometry.
 */
export function getPlacementEnvelopes(
  circuitJson: AnyCircuitElement[],
): PlacementEnvelope[] {
  const envelopes: PlacementEnvelope[] = circuitJson.filter(
    (el): el is CourtyardElement =>
      el.type === "pcb_courtyard_rect" ||
      el.type === "pcb_courtyard_circle" ||
      el.type === "pcb_courtyard_outline" ||
      el.type === "pcb_courtyard_polygon",
  )
  // Reuse the missing-courtyard eligibility rules (manual vias and test points
  // are not assembled component bodies).
  const missingIds = new Set(
    checkPcbComponentsMissingCourtyard(circuitJson).map(
      (w) => w.pcb_component_id,
    ),
  )
  for (const el of circuitJson) {
    if (el.type !== "pcb_component" || el.do_not_place) continue
    if (!missingIds.has(el.pcb_component_id)) continue
    if (el.layer !== "top" && el.layer !== "bottom") continue
    // Split headers and tall modules may explicitly allow placement inside
    // their bounds; their pads remain covered by the copper overlap checks.
    if (el.obstructs_within_bounds === false) continue
    if (
      !Number.isFinite(el.center?.x) ||
      !Number.isFinite(el.center?.y) ||
      !Number.isFinite(el.width) ||
      !Number.isFinite(el.height) ||
      el.width <= 0 ||
      el.height <= 0
    )
      continue
    envelopes.push({
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: `component_bounds_${el.pcb_component_id}`,
      pcb_component_id: el.pcb_component_id,
      layer: el.layer,
      center: el.center,
      width: el.width,
      height: el.height,
      // pcb_component width/height already describe axis-aligned world bounds.
      // Applying component.rotation here would rotate those bounds twice.
      ccw_rotation: 0,
      usesComponentBounds: true,
    })
  }
  return envelopes
}
