import * as Flatten from "@flatten-js/core"
import {
  getPrimaryId,
  getReadableNameForElement,
} from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  PcbCopperPour,
  PcbPlacementError,
} from "circuit-json"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { getTraceSegments } from "./check-pad-clearance/common"
import {
  getCopperGeometry,
  type CopperElement,
  type CopperGeometry,
} from "./util/copper-geometry"
import { getLayersOfPcbElement } from "./util/getLayersOfPcbElement"

const EPSILON = 1e-9

/** Filled polygons include their holes, so copper wholly in a cutout is safe. */
function touchesPour(pour: Flatten.Polygon, geometry: CopperGeometry): boolean {
  const box = pour.box
  const bounds =
    geometry.kind === "pill"
      ? geometry.centerLine.box
      : geometry.shapes.reduce(
          (box, shape) => box.merge(shape.box),
          geometry.shapes[0].box,
        )
  const radius = geometry.kind === "pill" ? geometry.radius : 0
  if (
    bounds.xmax + radius < box.xmin ||
    bounds.xmin - radius > box.xmax ||
    bounds.ymax + radius < box.ymin ||
    bounds.ymin - radius > box.ymax
  )
    return false
  if (geometry.kind === "pill") {
    return (
      pour.contains(geometry.centerLine.start) ||
      pour.contains(geometry.centerLine.end) ||
      pour.distanceTo(geometry.centerLine)[0] <= geometry.radius + EPSILON
    )
  }
  return geometry.shapes.some((shape) => {
    if (shape instanceof Flatten.Circle) {
      return (
        pour.contains(shape.pc) ||
        shape.pc.distanceTo(pour)[0] <= shape.r + EPSILON
      )
    }
    return (
      pour.distanceTo(shape)[0] <= EPSILON ||
      shape.vertices.some((point) => pour.contains(point)) ||
      pour.vertices.some((point) => shape.contains(point))
    )
  })
}

/** Detect accidental copper contact, rather than enforcing a clearance margin. */
export function checkCopperPourShorts(
  circuitJson: AnyCircuitElement[],
): PcbPlacementError[] {
  const pours = circuitJson.filter(
    (e): e is PcbCopperPour => e.type === "pcb_copper_pour",
  )
  if (!pours.length) return []
  const connMap = getFullConnectivityMapFromCircuitJson(circuitJson)
  const rotations = new Map(
    circuitJson
      .filter((e) => e.type === "pcb_component")
      .map((e) => [e.pcb_component_id, e.rotation]),
  )
  const copper = circuitJson
    .filter(
      (e): e is CopperElement =>
        e.type === "pcb_smtpad" ||
        e.type === "pcb_plated_hole" ||
        e.type === "pcb_via" ||
        e.type === "pcb_copper_pour",
    )
    .flatMap((element) => {
      const geometry = getCopperGeometry(element, rotations, true)
      return geometry
        ? [
            {
              id: getPrimaryId(element),
              element,
              geometry,
              layers:
                element.type === "pcb_copper_pour"
                  ? [element.layer]
                  : getLayersOfPcbElement(element),
              netId:
                element.type === "pcb_copper_pour"
                  ? element.source_net_id
                  : getPrimaryId(element),
            },
          ]
        : []
    })
  const segments = getTraceSegments(circuitJson).map((segment) => ({
    id: segment.pcb_trace_id,
    netId: segment.pcb_trace_id,
    layers: [segment.layer],
    geometry: {
      kind: "pill" as const,
      radius: segment.thickness / 2,
      centerLine: new Flatten.Segment(
        new Flatten.Point(segment.x1, segment.y1),
        new Flatten.Point(segment.x2, segment.y2),
      ),
    },
  }))
  const netNames = new Map(
    circuitJson
      .filter((e) => e.type === "source_net")
      .map((e) => [e.source_net_id, e.name]),
  )
  const obstacles = [...copper, ...segments]
  const errors = new Map<string, PcbPlacementError>()
  for (const pour of copper) {
    if (
      pour.element.type !== "pcb_copper_pour" ||
      pour.geometry.kind !== "shapes"
    )
      continue
    const polygon = pour.geometry.shapes[0] as Flatten.Polygon
    for (const other of obstacles) {
      if (pour.id === other.id || !other.layers.includes(pour.element.layer))
        continue
      if (
        pour.netId &&
        other.netId &&
        (pour.netId === other.netId ||
          connMap.areIdsConnected(pour.netId, other.netId))
      )
        continue
      const id = `copper_pour_short_${[pour.id, other.id].sort().join("_")}`
      if (errors.has(id) || !touchesPour(polygon, other.geometry)) continue
      errors.set(id, {
        type: "pcb_placement_error",
        pcb_placement_error_id: id,
        error_type: "pcb_placement_error",
        message: `Copper pour ${pour.id} (${netNames.get(pour.netId!) ?? pour.netId ?? "unassigned net"}) shorts to ${getReadableNameForElement(circuitJson, other.id)} (${other.id}) on ${pour.element.layer} (accidental copper contact)`,
        subcircuit_id: pour.element.subcircuit_id,
      })
    }
  }
  return [...errors.values()]
}
