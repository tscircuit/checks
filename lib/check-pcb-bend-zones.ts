import { getBoardOwnerResolver } from "./util/get-board-owner-resolver"
import {
  getReadableNameForElementId,
  getReadableNameForTrace,
} from "lib/util/get-readable-names"
import { getPrimaryId } from "@tscircuit/circuit-json-util"
import {
  all_layers,
  type AnyCircuitElement,
  type PCBKeepout,
  type PcbBend,
  type PcbBoard,
  type PcbPlacementError,
  type PcbStiffener,
  type PcbTrace,
  type PcbTraceError,
  type PcbVia,
  type Point,
} from "circuit-json"
import {
  getRotatedRectPoints,
  getSegmentToPolygonClearanceFromPoints,
} from "./check-each-pcb-trace-non-overlapping/segment-to-polygon-clearance"
import { getPads, getPadToPadGap } from "./check-pad-clearance/common"

const GEOMETRY_EPSILON = 1e-9
const INNER_LAYERS = all_layers.filter((layer) => layer.startsWith("inner"))

function getBoardLayerStack(board: PcbBoard): string[] {
  return [
    "top",
    ...INNER_LAYERS.slice(0, Math.max(0, board.num_layers - 2)),
    ...(board.num_layers === 1 ? [] : ["bottom"]),
  ]
}

function getRouteContactOnLayer(
  point: PcbTrace["route"][number],
  layer: string,
  side: "incoming" | "outgoing",
  stack: string[],
): Point | undefined {
  if (point.route_type === "wire") {
    return point.layer === layer ? point : undefined
  }
  if (point.route_type === "through_pad") {
    if (side === "incoming") {
      return point.end_layer === layer
        ? point.end
        : point.start_layer === layer
          ? point.start
          : undefined
    }
    return point.start_layer === layer
      ? point.start
      : point.end_layer === layer
        ? point.end
        : undefined
  }
  const fromIndex = stack.indexOf(point.from_layer)
  const toIndex = stack.indexOf(point.to_layer)
  const targetIndex = stack.indexOf(layer)
  if (fromIndex >= 0 && toIndex >= 0 && targetIndex >= 0) {
    return targetIndex >= Math.min(fromIndex, toIndex) &&
      targetIndex <= Math.max(fromIndex, toIndex)
      ? point
      : undefined
  }
  return point.from_layer === layer || point.to_layer === layer
    ? point
    : undefined
}

function getBendZones(circuitJson: AnyCircuitElement[]) {
  const boards = new Map(
    circuitJson
      .filter((element): element is PcbBoard => element.type === "pcb_board")
      .map((board) => [board.pcb_board_id, board]),
  )
  return circuitJson.flatMap((bend) => {
    if (bend.type !== "pcb_bend") return []
    const board = boards.get(bend.pcb_board_id)
    if (!board) return []
    const dx = bend.end.x - bend.start.x
    const dy = bend.end.y - bend.start.y
    const length = Math.hypot(dx, dy)
    const width = bend.bend_radius * Math.abs((bend.bend_angle * Math.PI) / 180)
    if (
      !Number.isFinite(length) ||
      !Number.isFinite(width) ||
      length <= GEOMETRY_EPSILON ||
      width <= GEOMETRY_EPSILON
    )
      return []
    const tangent = { x: dx / length, y: dy / length }
    const offset = { x: (-tangent.y * width) / 2, y: (tangent.x * width) / 2 }
    const start = {
      x: board.center.x + bend.start.x,
      y: board.center.y + bend.start.y,
    }
    const end = {
      x: board.center.x + bend.end.x,
      y: board.center.y + bend.end.y,
    }
    const outline = [
      { x: start.x + offset.x, y: start.y + offset.y },
      { x: end.x + offset.x, y: end.y + offset.y },
      { x: end.x - offset.x, y: end.y - offset.y },
      { x: start.x - offset.x, y: start.y - offset.y },
    ]
    const keepout: Extract<PCBKeepout, { shape: "outline" }> = {
      type: "pcb_keepout",
      pcb_keepout_id: bend.pcb_bend_id,
      shape: "outline",
      outline,
      stroke_width: 0,
      layers: ["top", "bottom"],
    }
    return [{ bend, board, tangent, keepout }]
  })
}

function getStiffenerOutline(
  stiffener: PcbStiffener,
  board: PcbBoard,
): Point[] {
  const points =
    stiffener.shape === "polygon"
      ? stiffener.outline
      : getRotatedRectPoints({
          x: stiffener.center.x,
          y: stiffener.center.y,
          width: stiffener.width,
          height: stiffener.height,
          ccwRotation: stiffener.rotation ?? 0,
        })
  return points.map((point) => ({
    x: point.x + board.center.x,
    y: point.y + board.center.y,
  }))
}

/** The bend zone is a finite rectangle centered on the bend segment. Its
 * neutral-surface width is radius * abs(angle in radians), independent of side.
 * Pads and vias already use world coordinates; bends and stiffeners are local
 * to the board center. All geometry is in mm in the right-handed flat PCB frame
 * (+X right, +Y up, +Z above). Both attachment faces are checked. */
export function checkPcbBendZonePlacement(
  circuitJson: AnyCircuitElement[],
): PcbPlacementError[] {
  const zones = getBendZones(circuitJson)
  if (zones.length === 0) return []
  const getBoardOwner = getBoardOwnerResolver(circuitJson)
  const copper = [
    ...getPads(circuitJson),
    ...circuitJson.filter((element) => element.type === "pcb_via"),
  ].map((element) => ({ element, boardId: getBoardOwner(element) }))
  // Primitive pcbtraces can carry vias without materialized pcb_via records.
  for (const trace of circuitJson) {
    if (trace.type !== "pcb_trace") continue
    const boardId = getBoardOwner(trace)
    for (const [index, point] of trace.route.entries()) {
      if (point.route_type !== "via") continue
      const outerDiameter = point.outer_diameter ?? point.hole_diameter ?? 0
      const alreadyMaterialized = copper.some(
        ({ element, boardId: viaBoardId }) =>
          element.type === "pcb_via" &&
          !(boardId && viaBoardId && boardId !== viaBoardId) &&
          Math.hypot(element.x - point.x, element.y - point.y) <=
            GEOMETRY_EPSILON &&
          element.layers.includes(point.from_layer) &&
          element.layers.includes(point.to_layer) &&
          (point.outer_diameter === undefined ||
            Math.abs(element.outer_diameter - outerDiameter) <=
              GEOMETRY_EPSILON) &&
          (point.hole_diameter === undefined ||
            Math.abs(element.hole_diameter - point.hole_diameter) <=
              GEOMETRY_EPSILON),
      )
      if (alreadyMaterialized) continue
      const element: PcbVia = {
        type: "pcb_via",
        pcb_via_id: `${trace.pcb_trace_id}_route_via_${index}`,
        pcb_trace_id: trace.pcb_trace_id,
        x: point.x,
        y: point.y,
        outer_diameter: outerDiameter,
        hole_diameter: point.hole_diameter ?? 0,
        layers: [point.from_layer, point.to_layer],
        subcircuit_id: trace.subcircuit_id,
      }
      copper.push({ element, boardId })
    }
  }
  const stiffeners = circuitJson.filter(
    (element): element is PcbStiffener => element.type === "pcb_stiffener",
  )
  const errors: PcbPlacementError[] = []
  const report = (elementId: string, bend: PcbBend, subcircuitId?: string) => {
    errors.push({
      type: "pcb_placement_error",
      pcb_placement_error_id: `bend_zone_${bend.pcb_bend_id}_${elementId}`,
      error_type: "pcb_placement_error",
      message: `${getReadableNameForElementId(circuitJson, elementId)} overlaps PCB bend zone ${getReadableNameForElementId(circuitJson, bend.pcb_bend_id)}`,
      subcircuit_id: subcircuitId ?? bend.subcircuit_id,
    })
  }
  for (const { bend, board, keepout } of zones) {
    for (const { element, boardId } of copper) {
      if (boardId && boardId !== board.pcb_board_id) continue
      if (getPadToPadGap(element, keepout) <= GEOMETRY_EPSILON) {
        report(getPrimaryId(element), bend, element.subcircuit_id)
      }
    }
    for (const stiffener of stiffeners) {
      if (stiffener.pcb_board_id !== board.pcb_board_id) continue
      const outline = getStiffenerOutline(stiffener, board)
      if (outline.length < 3) continue
      if (
        getPadToPadGap(
          { ...keepout, outline, pcb_keepout_id: stiffener.pcb_stiffener_id },
          keepout,
        ) <= GEOMETRY_EPSILON
      ) {
        report(stiffener.pcb_stiffener_id, bend, stiffener.subcircuit_id)
      }
    }
  }
  return errors
}

/** Straight copper may cross a bend perpendicular to its axis. Direction
 * changes and copper running along or diagonally across the zone are invalid.
 * Tapered segments use their maximum outgoing width for the overlap test. */
export function checkPcbBendZoneTraces(
  circuitJson: AnyCircuitElement[],
): PcbTraceError[] {
  const zones = getBendZones(circuitJson)
  if (zones.length === 0) return []
  const getBoardOwner = getBoardOwnerResolver(circuitJson)
  const errors: PcbTraceError[] = []
  for (const trace of circuitJson) {
    if (trace.type !== "pcb_trace") continue
    const boardId = getBoardOwner(trace)
    for (const { bend, board, tangent, keepout } of zones) {
      if (boardId && boardId !== bend.pcb_board_id) continue
      const stack = getBoardLayerStack(board)
      let violation: { center: Point; reason: string } | undefined
      for (let i = 1; i < trace.route.length; i++) {
        const a = trace.route[i - 1]!
        const b = trace.route[i]!
        const wire =
          a.route_type === "wire" ? a : b.route_type === "wire" ? b : undefined
        if (!wire) continue
        const aPoint = getRouteContactOnLayer(a, wire.layer, "incoming", stack)
        const bPoint = getRouteContactOnLayer(b, wire.layer, "outgoing", stack)
        if (!aPoint || !bPoint) continue
        const dx = bPoint.x - aPoint.x
        const dy = bPoint.y - aPoint.y
        const length = Math.hypot(dx, dy)
        if (length <= GEOMETRY_EPSILON) continue
        const alongBend = Math.abs(dx * tangent.x + dy * tangent.y) / length
        if (alongBend <= GEOMETRY_EPSILON) continue
        const radius =
          Math.max(wire.width, wire.start_width ?? 0, wire.end_width ?? 0) / 2
        const clearance = getSegmentToPolygonClearanceFromPoints(
          aPoint,
          bPoint,
          keepout.outline,
        )
        if (clearance.distance > radius + GEOMETRY_EPSILON) continue
        violation = {
          center: clearance.center,
          reason: "Non-perpendicular trace copper",
        }
        break
      }
      // A reversal is also a corner even though both segments are perpendicular.
      // Ignore duplicate samples so repeated route points cannot hide a corner.
      for (let i = 1; !violation && i < trace.route.length - 1; i++) {
        const point = trace.route[i]!
        if (point.route_type !== "wire") continue
        let previousIndex = i - 1
        let nextIndex = i + 1
        while (previousIndex >= 0) {
          const previous = trace.route[previousIndex]!
          if (
            previous.route_type !== "wire" ||
            previous.layer !== point.layer ||
            Math.hypot(previous.x - point.x, previous.y - point.y) >
              GEOMETRY_EPSILON
          )
            break
          previousIndex--
        }
        while (nextIndex < trace.route.length) {
          const next = trace.route[nextIndex]!
          if (
            next.route_type !== "wire" ||
            next.layer !== point.layer ||
            Math.hypot(next.x - point.x, next.y - point.y) > GEOMETRY_EPSILON
          )
            break
          nextIndex++
        }
        const previous = trace.route[previousIndex]
        const next = trace.route[nextIndex]
        const previousContact = previous
          ? getRouteContactOnLayer(previous, point.layer, "incoming", stack)
          : undefined
        const nextContact = next
          ? getRouteContactOnLayer(next, point.layer, "outgoing", stack)
          : undefined
        if (!previousContact || !nextContact) continue
        const incoming = {
          x: point.x - previousContact.x,
          y: point.y - previousContact.y,
        }
        const outgoing = {
          x: nextContact.x - point.x,
          y: nextContact.y - point.y,
        }
        const lengths =
          Math.hypot(incoming.x, incoming.y) *
          Math.hypot(outgoing.x, outgoing.y)
        if (lengths <= GEOMETRY_EPSILON) continue
        const dot =
          (incoming.x * outgoing.x + incoming.y * outgoing.y) / lengths
        const cross =
          (incoming.x * outgoing.y - incoming.y * outgoing.x) / lengths
        if (dot > 0 && Math.abs(cross) <= GEOMETRY_EPSILON) continue
        const incomingWidth =
          previous?.route_type === "wire"
            ? Math.max(previous.width, previous.end_width ?? 0)
            : Math.max(point.width, point.start_width ?? 0)
        const radius =
          Math.max(incomingWidth, point.width, point.start_width ?? 0) / 2
        const clearance = getSegmentToPolygonClearanceFromPoints(
          point,
          point,
          keepout.outline,
        )
        if (clearance.distance > radius + GEOMETRY_EPSILON) continue
        violation = { center: point, reason: "Trace corner" }
      }
      if (!violation) continue
      errors.push({
        type: "pcb_trace_error",
        pcb_trace_error_id: `bend_zone_${bend.pcb_bend_id}_${trace.pcb_trace_id}`,
        error_type: "pcb_trace_error",
        message: `${violation.reason} for ${getReadableNameForTrace(circuitJson, trace.pcb_trace_id)} overlaps PCB bend zone ${getReadableNameForElementId(circuitJson, bend.pcb_bend_id)}`,
        center: violation.center,
        pcb_trace_id: trace.pcb_trace_id,
        source_trace_id: trace.source_trace_id ?? "",
        pcb_component_ids: trace.pcb_component_id
          ? [trace.pcb_component_id]
          : [],
        pcb_port_ids: [],
        subcircuit_id: trace.subcircuit_id ?? bend.subcircuit_id,
      })
    }
  }
  return errors
}
