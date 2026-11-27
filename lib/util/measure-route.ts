import { point, segment } from "@flatten-js/core"
import { getSmtPadPolygon } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  PcbPort,
  PcbTrace,
  SourceTrace,
} from "circuit-json"

type Point = { x: number; y: number }
export interface RouteSegment {
  a: Point
  b: Point
  layer: string
  width: number
}
export interface RouteMeasurement {
  length: number
  manhattan: number
  segments: RouteSegment[]
}

/** Board-world XY millimetres; +X right, +Y up. Measures planar copper from
 * pad centres, including escapes. Cached trace_length and guessed via depths
 * are deliberately excluded. Unsupported/branched/disconnected geometry is
 * unverified rather than a zero-length route or a successful timing check. */
export function measureRoute(
  source: SourceTrace,
  traces: PcbTrace[],
  circuit: AnyCircuitElement[],
): RouteMeasurement | undefined {
  if (source.connected_source_port_ids.length !== 2 || !traces.length) return
  const ports = source.connected_source_port_ids.map((id) =>
    circuit.filter(
      (e): e is PcbPort => e.type === "pcb_port" && e.source_port_id === id,
    ),
  )
  if (ports.some((p) => p.length !== 1)) return
  const nodes = new Map<
    string,
    { point: Point; layer: string; edges: Set<string> }
  >()
  const edges = new Set<string>()
  const segments: RouteSegment[] = []
  const key = (p: Point, layer: string) =>
    `${p.x.toFixed(6)},${p.y.toFixed(6)},${layer}`
  let valid = true
  const add = (a: Point, al: string, b: Point, bl: string, width: number) => {
    if (![a.x, a.y, b.x, b.y, width].every(Number.isFinite)) {
      valid = false
      return
    }
    const ak = key(a, al),
      bk = key(b, bl)
    if (ak === bk) return
    const edge = [ak, bk].sort().join("|")
    if (edges.has(edge)) {
      valid = false
      return
    }
    edges.add(edge)
    for (const [k, p, l, other] of [
      [ak, a, al, bk],
      [bk, b, bl, ak],
    ] as const) {
      if (!nodes.has(k)) nodes.set(k, { point: p, layer: l, edges: new Set() })
      nodes.get(k)!.edges.add(other)
    }
    if (al === bl) {
      if (width <= 0) valid = false
      segments.push({ a, b, layer: al, width })
    } else if (Math.hypot(a.x - b.x, a.y - b.y) > 1e-6) valid = false
  }
  for (const trace of traces) {
    for (let i = 0; i < trace.route.length; i++) {
      const p = trace.route[i]!,
        q = trace.route[i + 1]
      if (p.route_type === "through_pad" || q?.route_type === "through_pad")
        return
      if (p.route_type === "wire" && p.width_interpolation_mode) return
      if (p.route_type === "via") add(p, p.from_layer, p, p.to_layer, 0)
      if (!q) continue
      const pl = p.route_type === "wire" ? p.layer : p.to_layer
      const ql = q.route_type === "wire" ? q.layer : q.from_layer
      if (pl !== ql) {
        valid = false
        continue
      }
      const width =
        p.route_type === "wire"
          ? Math.max(p.width, p.end_width ?? p.width)
          : q.route_type === "wire"
            ? q.width
            : 0
      add(p, pl, q, ql, width)
    }
  }
  // Separate PCB via records can join fragments produced by fanout phases.
  for (const via of circuit.filter((e) => e.type === "pcb_via")) {
    const present = via.layers.filter((layer) => nodes.has(key(via, layer)))
    if (present.length > 2) {
      valid = false
      continue
    }
    if (present.length === 2) {
      const a = key(via, present[0]!),
        b = key(via, present[1]!)
      if (!edges.has([a, b].sort().join("|")))
        add(via, present[0]!, via, present[1]!, 0)
    }
  }
  if (
    !valid ||
    !segments.length ||
    [...nodes.values()].some((n) => n.edges.size > 2)
  )
    return
  const ends = [...nodes.entries()].filter(([, n]) => n.edges.size === 1)
  if (ends.length !== 2) return
  const padApproachLength = (port: PcbPort, end: (typeof ends)[number][1]) => {
    if (!port.layers.includes(end.layer as PcbPort["layers"][number])) return
    const distance = Math.hypot(port.x - end.point.x, port.y - end.point.y)
    if (distance <= 1e-5) return 0
    const center = point(port.x, port.y)
    const tip = point(end.point.x, end.point.y)
    for (const pad of circuit) {
      if (
        pad.type !== "pcb_smtpad" ||
        pad.pcb_port_id !== port.pcb_port_id ||
        pad.layer !== end.layer
      )
        continue
      const copper = getSmtPadPolygon(pad)
      if (!copper.contains(segment(center, tip))) continue
      const neighbor = nodes.get([...end.edges][0]!)!
      if (neighbor.layer !== end.layer) return distance
      // Stop at the pin center if the wire runs past it inside the pad.
      const wire = segment(tip, point(neighbor.point.x, neighbor.point.y))
      return wire.contains(center) ? -distance : distance
    }
  }
  const [first, last] = ports.map((p) => p[0]!)
  const approachLengths = ends
    .map(([, end], i) => {
      const startMm = padApproachLength(first!, end)
      const endMm = padApproachLength(last!, ends[1 - i]![1])
      if (startMm !== undefined && endMm !== undefined) return startMm + endMm
    })
    .filter((mm): mm is number => mm !== undefined)
  if (approachLengths.length !== 1) return
  const seen = new Set<string>(),
    pending = [ends[0]![0]]
  while (pending.length) {
    const k = pending.pop()!
    if (seen.has(k)) continue
    seen.add(k)
    pending.push(...nodes.get(k)!.edges)
  }
  if (seen.size !== nodes.size) return
  return {
    length: segments.reduce(
      (s, e) => s + Math.hypot(e.a.x - e.b.x, e.a.y - e.b.y),
      approachLengths[0]!,
    ),
    manhattan: Math.abs(first!.x - last!.x) + Math.abs(first!.y - last!.y),
    segments,
  }
}
