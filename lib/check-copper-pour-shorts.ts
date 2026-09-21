import Flatbush from "flatbush"
import * as Flatten from "@flatten-js/core"
import { getReadableNameForElement } from "@tscircuit/circuit-json-util"
import {
  convertCircuitJsonToFlattenJs,
  type FlattenElement,
} from "@tscircuit/circuit-json-to-flattenjs"
import type { AnyCircuitElement, PcbPlacementError } from "circuit-json"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"

/** Filled polygons include their holes, so copper wholly in a cutout is safe. */
function touchesPour(
  pour: Flatten.Polygon,
  geometry: Flatten.Polygon,
): boolean {
  if (!pour.box.intersect(geometry.box)) return false
  // distanceTo can report zero between tiny BRep segments and distant arcs.
  // Test actual boundary intersections and containment instead. Once boundaries
  // are disjoint, one point per face suffices; walking every pour vertex is costly.
  return (
    pour.intersect(geometry).length > 0 ||
    [...geometry.faces].some((face) => pour.contains(face.first.start)) ||
    [...pour.faces].some((face) => geometry.contains(face.first.start))
  )
}

/** Detect accidental copper contact, rather than enforcing a clearance margin. */
export function checkCopperPourShorts(
  circuitJson: AnyCircuitElement[],
  { connMap }: { connMap?: ConnectivityMap } = {},
): PcbPlacementError[] {
  if (!circuitJson.some((e) => e.type === "pcb_copper_pour")) return []
  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
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
  // Index individual shapes, not whole trace bounds, separately on each layer.
  // A long routed trace can have a large bounding box but few nearby segments.
  const layers = new Map<
    string | null,
    { element: FlattenElement; shape: Flatten.Polygon }[]
  >()
  for (const element of copper) {
    const entries = layers.get(element.layer) ?? []
    for (const shape of element.shapes) entries.push({ element, shape })
    layers.set(element.layer, entries)
  }
  const indexes = new Map(
    [...layers].map(([layer, entries]) => {
      const index = new Flatbush(entries.length)
      for (const { shape } of entries) {
        const b = shape.box
        index.add(b.xmin, b.ymin, b.xmax, b.ymax)
      }
      index.finish()
      return [layer, { index, entries }] as const
    }),
  )
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
    const { index, entries } = indexes.get(pour.layer)!
    const candidates = new Set<number>()
    for (const shape of pour.shapes) {
      const b = shape.box
      for (const i of index.search(b.xmin, b.ymin, b.xmax, b.ymax))
        candidates.add(i)
    }
    // Preserve source order so error output is deterministic across index layouts.
    for (const i of [...candidates].sort((a, b) => a - b)) {
      const { element: other, shape: otherShape } = entries[i]
      if (pour.elementId === other.elementId) continue
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
        !pour.shapes.some((shape) => touchesPour(shape, otherShape))
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
