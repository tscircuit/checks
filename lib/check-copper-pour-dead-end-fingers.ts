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

interface BoundaryPoint {
  point: Point
  edge: PolygonEdge
}

type Orientation = ReturnType<Polygon["orientation"]>

const EPSILON = 1e-6

function distanceToNeck(point: Point, neck: Segment): number {
  return point.distanceTo(neck)[0]
}

// Flatten's arc flag is opposite to the polygon orientation convention here.
function arcOrientation(arc: Arc): number {
  if (arc.counterClockwise) return -1
  return 1
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
  orientation: Orientation,
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
  for (const edge of nearby) {
    if (edge.shape.contains(middle)) return false
    for (const point of edge.shape.intersect(neck)) {
      const crossesInside =
        neck.contains(point) &&
        edge.shape.contains(point) &&
        !point.equalTo(neck.start) &&
        !point.equalTo(neck.end)
      if (crossesInside) return false
    }
  }
  return true
}

// Include analytic arc extrema without turning rounded pours into a bitmap.
function boundaryPoints(polygon: Polygon): Point[] {
  const points: Point[] = []
  for (const edge of polygon.edges as Iterable<PolygonEdge>) {
    points.push(edge.start)
    if (!(edge.shape instanceof Arc)) continue
    for (const arc of edge.shape.breakToFunctional())
      points.push(arc.start, arc.middle())
  }
  return points
}

function findRoots(island: Polygon, orientation: Orientation): BoundaryPoint[] {
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
      arcOrientation(edge.shape) !== orientation
    ) {
      for (const point of [edge.start, edge.middle(), edge.end])
        roots.push({ point, edge })
    }
  }
  return roots
}

// Ties keep the earlier boundary point.
function farthestPoint(points: Point[], neck: Segment): Point {
  return points.reduce((farthest, point) => {
    if (distanceToNeck(farthest, neck) >= distanceToNeck(point, neck))
      return farthest
    return point
  })
}

function containsOtherLoop(
  island: Polygon,
  rootFace: PolygonEdge["face"],
  finger: Polygon,
): boolean {
  for (const face of island.faces) {
    if (face === rootFace) continue
    if (finger.box.intersect(face.box) && finger.contains(face.first.start))
      return true
  }
  return false
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
    for (const origin of findRoots(island, orientation)) {
      const root = origin.point
      const searchBox = new Box(
        root.x - maxWidth,
        root.y - maxWidth,
        root.x + maxWidth,
        root.y + maxWidth,
      )
      const nearby = island.edges.search(searchBox) as unknown as PolygonEdge[]
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

        const tip = farthestPoint(boundaryPoints(finger), neck)
        const halfPerimeter = ([...finger.faces][0].perimeter - 2 * width) / 2
        const length = Math.max(distanceToNeck(tip, neck), halfPerimeter)
        const averageWidth = finger.area() / length
        const fingerWidth = Math.max(width, averageWidth)
        if (length + EPSILON < minLength) continue
        if (averageWidth > maxWidth + EPSILON) continue
        if (length + EPSILON < minAspectRatio * fingerWidth) continue
        // A hole-bearing lobe is not a simple dead-end finger.
        if (containsOtherLoop(island, origin.edge.face, finger)) continue

        candidates.push({
          polygon: finger,
          neck,
          tip,
          length,
          width: fingerWidth,
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
  const halfLength = distanceToNeck(finger.tip, finger.neck) / 2
  return contacts.some(
    (point) => distanceToNeck(point, finger.neck) >= halfLength,
  )
}

function unifyTouchingShapes(
  shapes: Polygon[],
  touches: ReturnType<typeof createCopperPolygonContactTester>,
): Polygon[] {
  const islands: Polygon[] = []
  for (const shape of shapes) {
    let merged = shape
    for (let i = islands.length - 1; i >= 0; i--) {
      if (!touches(islands[i], merged)) continue
      merged = BooleanOperations.unify(islands[i], merged)
      islands.splice(i, 1)
    }
    islands.push(merged)
  }
  return islands
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
    let id: string | undefined = element.elementId
    if (source.type === "pcb_copper_pour") id = source.source_net_id
    if (!id) return undefined
    return connMap.getNetConnectedToId(id) ?? id
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
    const islands = unifyTouchingShapes(
      group.flatMap((element) => element.shapes),
      touches,
    )
    const net = netFor(group[0])
    const contacts = elements.filter(
      (element) =>
        element.sourceElement.type !== "pcb_copper_pour" &&
        element.layer === group[0].layer &&
        net !== undefined &&
        netFor(element) === net,
    )
    const isSupported = (finger: Finger) =>
      contacts.some((element) =>
        element.shapes.some((shape) => touchesDistalHalf(finger, shape)),
      )
    const reported: Finger[] = []
    const isDuplicate = (finger: Finger) =>
      reported.some(
        (previous) =>
          previous.polygon.contains(finger.tip) ||
          finger.polygon.contains(previous.tip),
      )

    const fingers = findFingers(islands, maxWidth, minLength, minAspectRatio)
    for (const finger of fingers) {
      if (isSupported(finger)) continue
      // Deduplicate only after checking contacts: a useful fork can still have
      // an unsupported child branch. Opposite root corners report once.
      if (isDuplicate(finger)) continue
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
