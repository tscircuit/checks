import type {
  AnyCircuitElement,
  LayerRef,
  PcbPort,
  PcbBoard,
  PcbTrace,
  SourceTrace,
} from "circuit-json"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { getCopperPourConnectivity } from "../copper-pour-connectivity/get-copper-pour-connectivity"
import { getPcbTraceLength } from "./get-pcb-trace-length"

export type PcbPathMeasurement =
  | { status: "measured"; length: number }
  | { status: "unavailable"; reason: string }

type Point = { x: number; y: number; layer: LayerRef }
type Edge = { to: string; length: number }

/** Measure an endpoint path in right-handed board-world mm (+X right,
 * +Y up, +Z above).
 * Nodes are copper centerline points on named layers, not directions.
 * Plane connectivity proves electrical contact, not a unique path length.
 * Unknown inner-layer depths are never treated as zero or evenly spaced.
 */
export function measureConstrainedPcbPath(
  circuit: AnyCircuitElement[],
  sourceTrace: SourceTrace,
  traces: PcbTrace[],
): PcbPathMeasurement {
  const scope = sourceTrace.max_length_constraint
  const endpoints =
    scope?.source_port_ids ?? sourceTrace.connected_source_port_ids
  const legacy = () => ({
    status: "measured" as const,
    length: traces.reduce((sum, trace) => sum + getPcbTraceLength(trace), 0),
  })
  if (endpoints.length !== 2)
    return scope?.origin === "decoupling"
      ? {
          status: "unavailable",
          reason:
            "the local decoupling target is ambiguous; specify both source-port endpoints",
        }
      : legacy()

  const ports = endpoints.map((id) =>
    circuit.filter(
      (e): e is PcbPort => e.type === "pcb_port" && e.source_port_id === id,
    ),
  )
  if (ports.some((list) => list.length !== 1))
    return scope?.origin === "decoupling"
      ? {
          status: "unavailable",
          reason: "the local endpoints do not each identify one PCB port",
        }
      : legacy()
  let candidates = traces
  if (scope?.origin === "decoupling") {
    const connectivity = getFullConnectivityMapFromCircuitJson(circuit)
    const pourConnectivity = getCopperPourConnectivity(circuit, connectivity)
    if (
      pourConnectivity.arePortsConnected(
        ports.map((list) => list[0].pcb_port_id),
      )
    ) {
      return {
        status: "unavailable",
        reason:
          "a copper plane connects the local endpoints; connectivity does not determine a unique return-path length",
      }
    }
    const net = connectivity.getNetConnectedToId(ports[0][0].pcb_port_id)
    if (net)
      candidates = circuit.filter(
        (e): e is PcbTrace =>
          e.type === "pcb_trace" &&
          connectivity.getNetConnectedToId(e.pcb_trace_id) === net,
      )
  }

  const graph = new Map<string, Edge[]>()
  const points = new Map<string, Point>()
  const nodesByPort = new Map<PcbPort["pcb_port_id"], Set<string>>()
  const segments: { a: string; b: string; length: number }[] = []
  const board = circuit.find(
    (e): e is PcbBoard =>
      e.type === "pcb_board" &&
      (!sourceTrace.subcircuit_id ||
        e.subcircuit_id === sourceTrace.subcircuit_id),
  )
  const depth = (a: LayerRef, b: LayerRef) => {
    if (a === b) return 0
    if ((a === "top" && b === "bottom") || (a === "bottom" && b === "top"))
      return (
        board?.thickness ?? (scope?.origin === "decoupling" ? Infinity : 1.6)
      )
    return Infinity
  }
  const node = (point: Point) => {
    const id = `${point.layer}:${point.x.toFixed(9)}:${point.y.toFixed(9)}`
    points.set(id, point)
    if (!graph.has(id)) graph.set(id, [])
    return id
  }
  const edge = (a: string, b: string, length: number) => {
    graph.get(a)!.push({ to: b, length })
    graph.get(b)!.push({ to: a, length })
  }
  const attach = (id: PcbPort["pcb_port_id"] | undefined, point: string) => {
    if (!id) return
    const nodes = nodesByPort.get(id) ?? new Set<string>()
    nodes.add(point)
    nodesByPort.set(id, nodes)
  }
  for (const trace of candidates) {
    let previous: Point | undefined
    for (const point of trace.route) {
      const start: Point =
        point.route_type === "through_pad"
          ? { ...point.start, layer: point.start_layer }
          : {
              x: point.x,
              y: point.y,
              layer:
                point.route_type === "wire" ? point.layer : point.from_layer,
            }
      const end: Point =
        point.route_type === "through_pad"
          ? { ...point.end, layer: point.end_layer }
          : {
              ...start,
              layer: point.route_type === "via" ? point.to_layer : start.layer,
            }
      const a = node(start),
        b = node(end)
      if (previous) {
        const prev = node(previous)
        if (previous.layer === start.layer)
          segments.push({
            a: prev,
            b: a,
            length: Math.hypot(start.x - previous.x, start.y - previous.y),
          })
        // A layer change needs emitted via/through-pad copper. Adjacent wire
        // vertices on different layers alone do not establish contact.
      }
      if (point.route_type === "wire") {
        attach(point.start_pcb_port_id, a)
        attach(point.end_pcb_port_id, a)
      } else {
        edge(
          a,
          b,
          Math.hypot(end.x - start.x, end.y - start.y) +
            depth(start.layer, end.layer),
        )
        if (point.route_type === "through_pad") {
          const pad = circuit.find(
            (e) =>
              (e.type === "pcb_smtpad" &&
                e.pcb_smtpad_id === point.pcb_smtpad_id) ||
              (e.type === "pcb_plated_hole" &&
                e.pcb_plated_hole_id === point.pcb_plated_hole_id),
          )
          if (pad?.type === "pcb_smtpad" || pad?.type === "pcb_plated_hole")
            attach(pad.pcb_port_id, a)
        }
      }
      previous = end
    }
  }
  // Split a segment at existing route vertices: a branch can terminate in the
  // middle of another fragment, without an explicit shared endpoint ID.
  for (const segment of segments) {
    const a = points.get(segment.a)!,
      b = points.get(segment.b)!
    const dx = b.x - a.x,
      dy = b.y - a.y,
      squared = dx * dx + dy * dy
    const splits = [
      { id: segment.a, t: 0 },
      { id: segment.b, t: 1 },
    ]
    if (squared > 0)
      for (const [id, p] of points) {
        if (p.layer !== a.layer || id === segment.a || id === segment.b)
          continue
        const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / squared
        if (
          t > 0 &&
          t < 1 &&
          Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) < 1e-9
        )
          splits.push({ id, t })
      }
    splits.sort((a, b) => a.t - b.t)
    for (let i = 1; i < splits.length; i++)
      edge(
        splits[i - 1].id,
        splits[i].id,
        segment.length * (splits[i].t - splits[i - 1].t),
      )
  }
  const endpointNodes = ports.map(
    (list) => nodesByPort.get(list[0].pcb_port_id) ?? new Set<string>(),
  )
  // Port centers can identify a route vertex when the router omitted IDs.
  // Emitted endpoint IDs are authoritative; historical PCB-port centers
  // can be placeholders and must not introduce a zero-length shortcut.
  for (const [i, list] of ports.entries())
    if (endpointNodes[i].size === 0)
      for (const [id, p] of points) {
        const port = list[0]
        if (
          port.layers.includes(p.layer) &&
          Math.hypot(port.x - p.x, port.y - p.y) < 1e-9
        )
          endpointNodes[i].add(id)
      }
  const distances = new Map<string, number>(
    [...endpointNodes[0]].map((id) => [id, 0]),
  )
  const pending = new Set(graph.keys())
  while (pending.size) {
    let current: string | undefined
    let best = Infinity
    for (const id of pending)
      if ((distances.get(id) ?? Infinity) < best) {
        current = id
        best = distances.get(id)!
      }
    if (!current) break
    if (endpointNodes[1].has(current))
      return { status: "measured", length: best }
    pending.delete(current)
    for (const e of graph.get(current)!)
      if (best + e.length < (distances.get(e.to) ?? Infinity))
        distances.set(e.to, best + e.length)
  }
  if (scope?.origin === "decoupling")
    return {
      status: "unavailable",
      reason:
        "the emitted copper does not expose a measurable local path (or a required layer depth is unknown)",
    }
  // Legacy explicit constraints without sufficient geometry retain their
  // previous enforcement, never disappearing because a path is unavailable.
  return legacy()
}
