import {
  Arc,
  BooleanOperations,
  Box,
  Polygon,
  Segment,
  type Point,
  type PolygonEdge,
} from "@flatten-js/core"
import {
  convertCircuitJsonToFlattenJs,
  type FlattenElement,
} from "@tscircuit/circuit-json-to-flattenjs"
import type { AnyCircuitElement, PcbPlacementError } from "circuit-json"
import {
  getFullConnectivityMapFromCircuitJson,
  type ConnectivityMap,
} from "circuit-json-to-connectivity-map"
import { getReadableNameForElementId } from "./util/get-readable-names"
import { polygonContainsPoint } from "./util/polygon-contains-point"
import { createCopperPolygonContactTester } from "./copper-pour-connectivity/create-copper-polygon-contact-tester"

export interface CopperPourDeadEndFingerOptions {
  /** Maximum neck and average finger width in mm. Default: 1. */
  maxWidth?: number
  /** Minimum estimated branch length in mm. Default: 2. */
  minLength?: number
  /** Minimum length / max(neck width, average width). Default: 4. */
  minAspectRatio?: number
  connMap?: ConnectivityMap
}

interface Finger {
  polygon: Polygon
  neck: Segment
  tip: Point
  length: number
  width: number
}

const EPSILON = 1e-6

interface BoundaryPoint {
  point: Point
  edge: PolygonEdge
}

function branchBetween(start: BoundaryPoint, end: BoundaryPoint): Polygon {
  const shapes: (Segment | Arc)[] = []
  const tail = start.edge.shape.split(start.point)[1]
  if (tail) shapes.push(tail)
  for (let edge = start.edge.next; edge !== end.edge; edge = edge.next)
    shapes.push(edge.shape)
  const head = end.edge.shape.split(end.point)[0]
  if (head) shapes.push(head)
  shapes.push(new Segment(end.point, start.point))
  return new Polygon(shapes)
}

function smallerBranch(
  start: BoundaryPoint,
  end: BoundaryPoint,
  orientation: ReturnType<Polygon["orientation"]>,
  islandArea: number,
): Polygon | undefined {
  const position = ({ edge, point }: BoundaryPoint) =>
    edge.arc_length + (edge.shape.split(point)[0]?.length ?? 0)
  const perimeter = start.edge.face.perimeter
  const forward = (position(end) - position(start) + perimeter) % perimeter
  if (forward > perimeter / 2) [start, end] = [end, start]
  // Build the short contour first; cloning/cutting the entire pour for every
  // candidate is prohibitive on routed boards with thousands of boundary edges.
  for (const [a, b] of [
    [start, end],
    [end, start],
  ]) {
    const branch = branchBetween(a, b)
    if (branch.orientation() === orientation && branch.area() <= islandArea / 2)
      return branch
  }
}

function neckCrossesCopper(island: Polygon, neck: Segment): boolean {
  const middle = neck.middle()
  if (!polygonContainsPoint(island, middle)) return false
  const nearby = island.edges.search(neck.box) as unknown as PolygonEdge[]
  // Keep this local to the neck. Flatten's polygon/segment relation splits
  // whole boundaries and can fail on tiny edges in real routed pours.
  return !nearby.some(
    (edge) =>
      edge.shape.contains(middle) ||
      edge.shape
        .intersect(neck)
        .some(
          (point) =>
            neck.contains(point) &&
            edge.shape.contains(point) &&
            !point.equalTo(neck.start) &&
            !point.equalTo(neck.end),
        ),
  )
}

// Include analytic arc extrema without turning rounded pours into a bitmap.
function boundaryPoints(polygon: Polygon): Point[] {
  return [...polygon.edges].flatMap((edge: PolygonEdge) => [
    edge.start,
    ...(edge.shape instanceof Arc
      ? edge.shape
          .breakToFunctional()
          .flatMap((arc) => [arc.start, arc.middle()])
      : []),
  ])
}

function findFingers(
  islands: Polygon[],
  maxWidth: number,
  minLength: number,
  minAspectRatio: number,
): Finger[] {
  const candidates: Finger[] = []
  for (const island of islands) {
    const orientation = island.orientation()
    const islandArea = island.area()
    const holes = new Map(
      [...island.faces]
        .filter((face) => face.orientation() !== orientation)
        .map((face) => [face, face.toPolygon()]),
    )
    const roots: BoundaryPoint[] = []
    for (const edge of island.edges as Iterable<PolygonEdge>) {
      if (edge.length <= EPSILON || edge.prev.length <= EPSILON) continue
      const turn = edge.prev.shape
        .tangentInEnd()
        .cross(edge.shape.tangentInStart())
      if (turn * orientation < -EPSILON) roots.push({ point: edge.start, edge })
      // Smooth, concave fillets have no reflex vertex at their tangent joins.
      if (
        edge.shape instanceof Arc &&
        (edge.shape.counterClockwise ? -1 : 1) !== orientation
      ) {
        roots.push(
          ...[edge.start, edge.middle(), edge.end].map((point) => ({
            point,
            edge,
          })),
        )
      }
    }
    for (const origin of roots) {
      const root = origin.point
      const nearby = island.edges.search(
        new Box(
          root.x - maxWidth,
          root.y - maxWidth,
          root.x + maxWidth,
          root.y + maxWidth,
        ),
      ) as unknown as PolygonEdge[]
      for (const edge of nearby) {
        // A cut joining different boundary loops opens a hole, not a dead end.
        if (edge === origin.edge || edge.face !== origin.edge.face) continue
        const [width, neck] = root.distanceTo(edge.shape)
        if (width <= EPSILON || width > maxWidth + EPSILON) continue
        // Most short chords on hole boundaries cross the void. Check that
        // small loop before casting a ray through all holes in a ground plane.
        const hole = holes.get(origin.edge.face)
        if (hole && polygonContainsPoint(hole, neck.middle())) continue
        // A neck must cross copper, not a notch, a cutout, or a boundary edge.
        if (!neckCrossesCopper(island, neck)) continue
        const finger = smallerBranch(
          origin,
          { point: neck.end, edge },
          orientation,
          islandArea,
        )
        if (!finger) continue
        const points = boundaryPoints(finger)
        const tip = points.reduce((a, b) =>
          a.distanceTo(neck)[0] >= b.distanceTo(neck)[0] ? a : b,
        )
        const length = Math.max(
          tip.distanceTo(neck)[0],
          ([...finger.faces][0].perimeter - 2 * width) / 2,
        )
        const averageWidth = finger.area() / length
        if (
          length + EPSILON < minLength ||
          averageWidth > maxWidth + EPSILON ||
          length + EPSILON < minAspectRatio * Math.max(width, averageWidth)
        )
          continue
        // A hole-bearing lobe is not a simple dead-end finger.
        if (
          [...island.faces].some(
            (face) =>
              face !== origin.edge.face &&
              finger.box.intersect(face.box) &&
              finger.contains(face.first.start),
          )
        )
          continue
        candidates.push({
          polygon: finger,
          neck,
          tip,
          length,
          width: Math.max(width, averageWidth),
        })
      }
    }
  }
  return candidates.sort((a, b) => b.length - a.length)
}

function touchesDistalHalf(finger: Finger, copper: Polygon): boolean {
  if (!finger.polygon.box.intersect(copper.box)) return false
  const contacts = [
    ...finger.polygon.intersect(copper),
    ...boundaryPoints(copper).filter((point) => finger.polygon.contains(point)),
    ...boundaryPoints(finger.polygon).filter((point) => copper.contains(point)),
  ]
  return contacts.some(
    (point) =>
      point.distanceTo(finger.neck)[0] >=
      finger.tip.distanceTo(finger.neck)[0] / 2,
  )
}

/**
 * Heuristic for long, narrow, single-neck branches in finished copper pours.
 * Same-net pours are united per layer before checking. Pads, vias, or traces
 * touching the distal half make a branch useful; a connection at its root does
 * not. This is advisory geometry review, not an RF/EMI or fabrication verdict.
 */
export function checkCopperPourDeadEndFingers(
  circuitJson: AnyCircuitElement[],
  {
    maxWidth = 1,
    minLength = 2,
    minAspectRatio = 4,
    connMap,
  }: CopperPourDeadEndFingerOptions = {},
): PcbPlacementError[] {
  for (const value of [maxWidth, minLength, minAspectRatio]) {
    if (!Number.isFinite(value) || value <= 0)
      throw new RangeError(
        "Copper-pour finger thresholds must be positive and finite",
      )
  }
  if (!circuitJson.some((element) => element.type === "pcb_copper_pour"))
    return []
  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
  const { elements } = convertCircuitJsonToFlattenJs(circuitJson, {
    elementTypes: [
      "pcb_copper_pour",
      "pcb_smtpad",
      "pcb_plated_hole",
      "pcb_via",
      "pcb_trace",
    ],
    strict: true,
  })
  const netFor = (element: FlattenElement) => {
    const source = element.sourceElement
    const id =
      source.type === "pcb_copper_pour"
        ? source.source_net_id
        : element.elementId
    return id ? (connMap.getNetConnectedToId(id) ?? id) : undefined
  }
  const pours = new Map<string, FlattenElement[]>()
  for (const element of elements) {
    if (element.sourceElement.type !== "pcb_copper_pour") continue
    const key = JSON.stringify([
      element.layer,
      netFor(element) ?? element.elementId,
    ])
    const group = pours.get(key) ?? []
    group.push(element)
    pours.set(key, group)
  }
  const errors: PcbPlacementError[] = []
  const touches = createCopperPolygonContactTester(EPSILON)
  for (const group of pours.values()) {
    const islands: Polygon[] = []
    for (const shape of group.flatMap((element) => element.shapes)) {
      let merged = shape
      for (let i = islands.length - 1; i >= 0; i--) {
        if (!touches(islands[i], merged)) continue
        merged = BooleanOperations.unify(islands[i], merged)
        islands.splice(i, 1)
      }
      islands.push(merged)
    }
    const net = netFor(group[0])
    const contacts = elements.filter(
      (element) =>
        element.sourceElement.type !== "pcb_copper_pour" &&
        element.layer === group[0].layer &&
        net !== undefined &&
        netFor(element) === net,
    )
    const reported: Finger[] = []
    for (const finger of findFingers(
      islands,
      maxWidth,
      minLength,
      minAspectRatio,
    )) {
      if (
        contacts.some((element) =>
          element.shapes.some((shape) => touchesDistalHalf(finger, shape)),
        )
      )
        continue
      // Deduplicate only after checking contacts: a useful fork can still have
      // an unsupported child branch. Opposite root corners report once.
      if (
        reported.some(
          (previous) =>
            previous.polygon.contains(finger.tip) ||
            finger.polygon.contains(previous.tip),
        )
      )
        continue
      const owner =
        group.find((element) =>
          element.shapes.some((shape) => shape.contains(finger.tip)),
        ) ?? group[0]
      const source = owner.sourceElement
      if (source.type !== "pcb_copper_pour") continue
      const name = getReadableNameForElementId(
        circuitJson,
        source.source_net_id ?? owner.elementId,
      )
      errors.push({
        type: "pcb_placement_error",
        error_type: "pcb_placement_error",
        pcb_placement_error_id: `copper_pour_dead_end_finger_${owner.elementId}_${reported.length}`,
        is_fatal: false,
        subcircuit_id: source.subcircuit_id,
        message: `Copper pour (${name}) on ${owner.layer} has a possible dead-end finger near (${finger.tip.x.toFixed(2)}mm, ${finger.tip.y.toFixed(2)}mm): approximately ${finger.length.toFixed(2)}mm long, ${finger.width.toFixed(2)}mm wide. Review the pour or add a same-net connection near the tip.`,
      })
      reported.push(finger)
    }
  }
  return errors
}
