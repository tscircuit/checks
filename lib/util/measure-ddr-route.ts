import type {
  AnyCircuitElement,
  PcbPort,
  PcbTrace,
  SourceTrace,
} from "circuit-json"

type Point = { x: number; y: number }
export interface DdrSegment {
  a: Point
  b: Point
  layer: string
  width: number
}
export interface DdrRouteMeasurement {
  length: number
  manhattan: number
  segments: DdrSegment[]
}

/** Board-world XY millimetres; +X right, +Y up. Measures planar copper from
 * pad centres, including escapes. Cached trace_length and guessed via depths
 * are deliberately excluded. Unsupported/branched/disconnected geometry is
 * unverified rather than a zero-length route or a successful timing check. */
export function measureDdrRoute(
  source: SourceTrace,
  traces: PcbTrace[],
  circuit: AnyCircuitElement[],
): DdrRouteMeasurement | undefined {
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
  const segments: DdrSegment[] = []
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
  const matches = (p: PcbPort, n: (typeof ends)[number][1]) =>
    p.layers.includes(n.layer as PcbPort["layers"][number]) &&
    Math.hypot(p.x - n.point.x, p.y - n.point.y) <= 1e-5
  const [first, last] = ports.map((p) => p[0]!)
  if (
    !(matches(first!, ends[0]![1]) && matches(last!, ends[1]![1])) &&
    !(matches(first!, ends[1]![1]) && matches(last!, ends[0]![1]))
  )
    return
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
      0,
    ),
    manhattan: Math.abs(first!.x - last!.x) + Math.abs(first!.y - last!.y),
    segments,
  }
}
