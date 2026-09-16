import * as Flatten from "@flatten-js/core"
import { getReadableNameForElement } from "@tscircuit/circuit-json-util"
import { convertCircuitJsonToFlattenJs } from "@tscircuit/circuit-json-to-flattenjs"
import type { AnyCircuitElement, PcbPlacementError } from "circuit-json"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"

/** Filled polygons include their holes, so copper wholly in a cutout is safe. */
function touchesPour(
  pour: Flatten.Polygon,
  geometry: Flatten.Polygon,
): boolean {
  if (!pour.box.intersect(geometry.box)) return false
  // distanceTo can report zero between tiny BRep segments and distant arcs.
  // Test actual boundary intersections and containment instead.
  return (
    pour.intersect(geometry).length > 0 ||
    geometry.vertices.some((point) => pour.contains(point)) ||
    pour.vertices.some((point) => geometry.contains(point))
  )
}

/** Detect accidental copper contact, rather than enforcing a clearance margin. */
export function checkCopperPourShorts(
  circuitJson: AnyCircuitElement[],
): PcbPlacementError[] {
  if (!circuitJson.some((e) => e.type === "pcb_copper_pour")) return []
  const connMap = getFullConnectivityMapFromCircuitJson(circuitJson)
  const { elements: copper } = convertCircuitJsonToFlattenJs(circuitJson, {
    elementTypes: [
      "pcb_smtpad",
      "pcb_plated_hole",
      "pcb_via",
      "pcb_trace",
      "pcb_copper_pour",
    ],
    strict: true,
  })
  const netNames = new Map(
    circuitJson
      .filter((e) => e.type === "source_net")
      .map((e) => [e.source_net_id, e.name]),
  )
  const errors = new Map<string, PcbPlacementError>()
  for (const pour of copper) {
    const element = pour.sourceElement
    if (element.type !== "pcb_copper_pour") continue
    const netId = element.source_net_id
    for (const other of copper) {
      if (pour.elementId === other.elementId || other.layer !== pour.layer)
        continue
      const otherNetId =
        other.sourceElement.type === "pcb_copper_pour"
          ? other.sourceElement.source_net_id
          : other.elementId
      if (
        netId &&
        otherNetId &&
        (netId === otherNetId || connMap.areIdsConnected(netId, otherNetId))
      )
        continue
      const id = `copper_pour_short_${[pour.elementId, other.elementId].sort().join("_")}`
      if (
        errors.has(id) ||
        !pour.shapes.some((shape) =>
          other.shapes.some((otherShape) => touchesPour(shape, otherShape)),
        )
      )
        continue
      errors.set(id, {
        type: "pcb_placement_error",
        pcb_placement_error_id: id,
        error_type: "pcb_placement_error",
        message: `Copper pour ${pour.elementId} (${netNames.get(netId!) ?? netId ?? "unassigned net"}) shorts to ${getReadableNameForElement(circuitJson, other.elementId)} (${other.elementId}) on ${pour.layer} (accidental copper contact)`,
        subcircuit_id: element.subcircuit_id,
      })
    }
  }
  return [...errors.values()]
}
