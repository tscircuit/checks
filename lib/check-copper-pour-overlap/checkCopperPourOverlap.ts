import * as Flatten from "@flatten-js/core"
import type {
  AnyCircuitElement,
  PcbCopperPour,
  PcbTraceError,
  Point,
} from "circuit-json"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"

/**
 * Two copper regions that share more than this much area (mm^2) are treated as a
 * real overlap. Regions that only touch along an edge intersect to zero area and
 * are left alone, the same way abutting planes are a clearance concern rather than
 * a short.
 */
const MIN_OVERLAP_AREA = 1e-3

type Ring = { x: number; y: number }[]

function signedArea(ring: Ring): number {
  let area = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    area += a.x * b.y - b.x * a.y
  }
  return area / 2
}

const toCcw = (ring: Ring): Ring =>
  signedArea(ring) < 0 ? [...ring].reverse() : ring
const toCw = (ring: Ring): Ring =>
  signedArea(ring) > 0 ? [...ring].reverse() : ring

function rectRing(pour: PcbCopperPour & { shape: "rect" }): Ring {
  const hw = pour.width / 2
  const hh = pour.height / 2
  const corners = [
    { x: -hw, y: -hh },
    { x: +hw, y: -hh },
    { x: +hw, y: +hh },
    { x: -hw, y: +hh },
  ]
  const angle = ((pour.rotation ?? 0) * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return corners.map(({ x, y }) => ({
    x: pour.center.x + x * cos - y * sin,
    y: pour.center.y + x * sin + y * cos,
  }))
}

/** Outer boundary and hole rings of a pour. Returns null when the shape has no usable outline. */
function getPourRings(
  pour: PcbCopperPour,
): { outer: Ring; holes: Ring[] } | null {
  if (pour.shape === "rect") {
    return { outer: rectRing(pour), holes: [] }
  }
  if (pour.shape === "polygon") {
    if (pour.points.length < 3) return null
    return { outer: pour.points.map((p) => ({ x: p.x, y: p.y })), holes: [] }
  }
  if (pour.shape === "brep") {
    const outer = pour.brep_shape.outer_ring.vertices.map((v) => ({
      x: v.x,
      y: v.y,
    }))
    if (outer.length < 3) return null
    // Bulge arcs are approximated by their endpoints. That only shifts the
    // boundary slightly and never changes whether two full-board fills overlap.
    const holes = (pour.brep_shape.inner_rings ?? [])
      .map((r) => r.vertices.map((v) => ({ x: v.x, y: v.y })))
      .filter((r) => r.length >= 3)
    return { outer, holes }
  }
  return null
}

function buildRegion(rings: { outer: Ring; holes: Ring[] }): Flatten.Polygon {
  const poly = new Flatten.Polygon()
  poly.addFace(toCcw(rings.outer).map((p) => new Flatten.Point(p.x, p.y)))
  for (const hole of rings.holes) {
    poly.addFace(toCw(hole).map((p) => new Flatten.Point(p.x, p.y)))
  }
  return poly
}

/** Center of the overlap between two pour regions. Returns null when they do not overlap. */
function getOverlapCenter(
  a: { outer: Ring; holes: Ring[] },
  b: { outer: Ring; holes: Ring[] },
): Point | null {
  try {
    const regionA = buildRegion(a)
    const regionB = buildRegion(b)
    const boxA = regionA.box
    const boxB = regionB.box
    if (
      boxA.xmax <= boxB.xmin ||
      boxB.xmax <= boxA.xmin ||
      boxA.ymax <= boxB.ymin ||
      boxB.ymax <= boxA.ymin
    ) {
      return null
    }
    const intersection = Flatten.BooleanOperations.intersect(regionA, regionB)
    if (!intersection) return null
    if (Math.abs(intersection.area()) <= MIN_OVERLAP_AREA) return null
    const box = intersection.box
    return { x: (box.xmin + box.xmax) / 2, y: (box.ymin + box.ymax) / 2 }
  } catch {
    // Degenerate or self-intersecting outlines can make the boolean op throw.
    // Skip the pair rather than crash the whole DRC run or raise a false short.
    return null
  }
}

function getNetName(
  circuitJson: AnyCircuitElement[],
  sourceNetId: string | undefined,
): string | undefined {
  if (!sourceNetId) return undefined
  const net = circuitJson.find(
    (el) => el.type === "source_net" && el.source_net_id === sourceNetId,
  )
  return net?.type === "source_net" ? net.name : sourceNetId
}

/**
 * Flags copper pours on the same layer that belong to different nets and whose
 * filled regions overlap. Overlapping fills on different nets are physically
 * connected copper, so the two nets are shorted together.
 *
 * This is the detection half of the short reported in tscircuit/core#3074, where
 * two default full-board pours on one layer each fill the whole board and overlap
 * with no diagnostic. The pour geometry itself is produced elsewhere; this check
 * only inspects the resulting pcb_copper_pour records.
 *
 * Net membership is resolved through the connectivity map, so two pours that name
 * different nets which are electrically tied are treated as the same net and left
 * alone, matching checkDifferentNetViaSpacing.
 */
export function checkCopperPourOverlap(
  circuitJson: AnyCircuitElement[],
  { connMap }: { connMap?: ConnectivityMap } = {},
): PcbTraceError[] {
  const pours = circuitJson.filter(
    (el): el is PcbCopperPour => el.type === "pcb_copper_pour",
  )
  if (pours.length < 2) return []

  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)

  const errors: PcbTraceError[] = []
  const reported = new Set<string>()

  for (let i = 0; i < pours.length; i++) {
    for (let j = i + 1; j < pours.length; j++) {
      const pourA = pours[i]
      const pourB = pours[j]

      if (pourA.layer !== pourB.layer) continue

      // Without a net on both pours we cannot prove they differ, so do not flag.
      if (!pourA.source_net_id || !pourB.source_net_id) continue
      if (connMap.areIdsConnected(pourA.source_net_id, pourB.source_net_id)) {
        continue
      }

      const ringsA = getPourRings(pourA)
      const ringsB = getPourRings(pourB)
      if (!ringsA || !ringsB) continue

      const center = getOverlapCenter(ringsA, ringsB)
      if (!center) continue

      const pairId = [pourA.pcb_copper_pour_id, pourB.pcb_copper_pour_id]
        .sort()
        .join("_")
      if (reported.has(pairId)) continue
      reported.add(pairId)

      const nameA =
        getNetName(circuitJson, pourA.source_net_id) ?? pourA.pcb_copper_pour_id
      const nameB =
        getNetName(circuitJson, pourB.source_net_id) ?? pourB.pcb_copper_pour_id

      errors.push({
        type: "pcb_trace_error",
        pcb_trace_error_id: `copper_pour_overlap_${pairId}`,
        error_type: "pcb_trace_error",
        message: `Copper pours connected to different nets ${nameA} and ${nameB} overlap on layer ${pourA.layer} and would short the two nets`,
        center,
        pcb_trace_id: "",
        source_trace_id: "",
        pcb_component_ids: [],
        pcb_port_ids: [],
      })
    }
  }

  return errors
}
