import type {
  AnyCircuitElement,
  LayerRef,
  PcbPort,
  PcbTrace,
  SourceTrace,
} from "circuit-json"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import Flatbush from "flatbush"
import { isPointInPad } from "../check-traces-are-contiguous/is-point-in-pad"
import { getPcbTraceLength } from "./get-pcb-trace-length"
import { getViaAndPourConnections } from "./get-via-and-pour-connections"

type SourceTraceId = SourceTrace["source_trace_id"]
type PcbTraceId = PcbTrace["pcb_trace_id"]
type PcbPortId = PcbPort["pcb_port_id"]
type Point = { x: number; y: number }
interface Arc {
  to: number
  length: number
  traceId?: PcbTraceId
  viaId?: string
  uncertain?: string
}
interface Node {
  point: Point
  layer: LayerRef
  arcs: Arc[]
}
interface Segment {
  a: Point
  b: Point
  layer: LayerRef
  width: number
  traceId: PcbTraceId
  cuts: number[]
}
export type PcbTracePathMeasurement =
  | {
      status: "measured"
      length: number
      pcbTraceIds: PcbTraceId[]
      pcbViaIds: string[]
      method: "shortest_copper_path" | "authored_route_length"
    }
  | {
      status: "indeterminate"
      reason: string
      knownPathLengthLowerBound?: number
      pcbTraceIds?: PcbTraceId[]
      pcbViaIds?: string[]
    }
const EPSILON = 1e-7
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const project = (p: Point, s: Segment) => {
  const dx = s.b.x - s.a.x,
    dy = s.b.y - s.a.y
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / (dx * dx + dy * dy),
    ),
  )
  return { t, point: { x: s.a.x + t * dx, y: s.a.y + t * dy } }
}
const interpolate = (s: Segment, t: number) => ({
  x: s.a.x + t * (s.b.x - s.a.x),
  y: s.a.y + t * (s.b.y - s.a.y),
})

/** Board-world points in mm, +X right, +Y up, layers ordered along Z. XY is
 * right handed with +Z above the board. Measures the shortest routed centreline
 * path, with pad traversal and barrel depth. Logical nets select candidates;
 * only physical copper contact adds graph edges. Pours have no unique routed
 * centreline, so paths reaching them are indeterminate. Inner-layer barrel
 * depths require a stackup and are never guessed from equally spaced layers. */
export function createPcbTracePathMeasurer(circuit: AnyCircuitElement[]) {
  const sourceTraces = circuit.filter((e) => e.type === "source_trace")
  const pcbTraces = circuit.filter((e) => e.type === "pcb_trace")
  const pcbPorts = circuit.filter((e) => e.type === "pcb_port")
  const logical = new ConnectivityMap({})
  logical.addConnections(
    sourceTraces.map((s) => [
      s.source_trace_id,
      ...s.connected_source_port_ids,
      ...s.connected_source_net_ids,
    ]),
  )
  const networkOf = (id: string) => logical.getNetConnectedToId(id)
  const tracesBySource = new Map<SourceTraceId, PcbTrace[]>()
  for (const trace of pcbTraces) {
    if (!trace.source_trace_id) continue
    const entries = tracesBySource.get(trace.source_trace_id) ?? []
    entries.push(trace)
    tracesBySource.set(trace.source_trace_id, entries)
  }
  const graphCache = new Map<string, ReturnType<typeof buildGraph>>()
  let pourContacts: string[][] | undefined

  function buildGraph(source: SourceTrace) {
    const network = networkOf(source.source_trace_id)
    const sameNetwork = (id: string | undefined) =>
      id !== undefined && network !== undefined && networkOf(id) === network
    const authored = source.max_length_origin === "explicit"
    const traces = pcbTraces.filter((t) =>
      authored
        ? t.source_trace_id === source.source_trace_id
        : sameNetwork(t.source_trace_id),
    )
    const referencedPortIds = new Set(
      traces.flatMap((t) =>
        t.route.flatMap((p) =>
          p.route_type === "wire"
            ? [p.start_pcb_port_id, p.end_pcb_port_id]
            : [],
        ),
      ),
    )
    const ports = pcbPorts.filter(
      (p) =>
        sameNetwork(p.source_port_id) || referencedPortIds.has(p.pcb_port_id),
    )
    const pads = circuit
      .filter((e) => e.type === "pcb_smtpad" || e.type === "pcb_plated_hole")
      .filter((e) => ports.some((p) => p.pcb_port_id === e.pcb_port_id))
    const boards = circuit.filter((e) => e.type === "pcb_board")
    const board =
      boards.find(
        (b) =>
          b.subcircuit_id !== undefined &&
          b.subcircuit_id === source.subcircuit_id,
      ) ?? (boards.length === 1 ? boards[0] : undefined)
    const nodes: Node[] = []
    const nodeIdsByPosition = new Map<string, number>()
    const node = (point: Point, layer: LayerRef) => {
      const key = `${point.x.toFixed(7)},${point.y.toFixed(7)},${layer}`
      let id = nodeIdsByPosition.get(key)
      if (id === undefined) {
        id = nodes.length
        nodes.push({ point, layer, arcs: [] })
        nodeIdsByPosition.set(key, id)
      }
      return id
    }
    const edge = (a: number, b: number, arc: Omit<Arc, "to">) => {
      if (a === b) return
      nodes[a]!.arcs.push({ to: b, ...arc })
      nodes[b]!.arcs.push({ to: a, ...arc })
    }
    const barrel = (
      point: Point,
      layers: LayerRef[],
      traceId?: PcbTraceId,
      viaId?: string,
    ) => {
      for (let i = 0; i < layers.length; i++)
        for (let j = i + 1; j < layers.length; j++) {
          const from = layers[i]!,
            to = layers[j]!
          const known =
            board !== undefined &&
            Number.isFinite(board.thickness) &&
            board.thickness > 0 &&
            ((from === "top" && to === "bottom") ||
              (from === "bottom" && to === "top"))
          edge(node(point, from), node(point, to), {
            length: known ? board!.thickness : 0,
            traceId,
            viaId,
            uncertain: known
              ? undefined
              : "Via or plated-pad depth is unavailable for this layer span",
          })
        }
    }
    const segments: Segment[] = []
    let unsupported = false
    const addSegment = (
      a: Point,
      b: Point,
      layer: LayerRef,
      width: number,
      traceId: PcbTraceId,
    ) => {
      if (![a.x, a.y, b.x, b.y, width].every(Number.isFinite) || width <= 0) {
        unsupported = true
        return
      }
      node(a, layer)
      node(b, layer)
      if (distance(a, b) > EPSILON)
        segments.push({ a, b, layer, width, traceId, cuts: [0, 1] })
    }
    const emittedVias = circuit.filter((e) => e.type === "pcb_via")
    for (const trace of traces) {
      for (let i = 0; i < trace.route.length; i++) {
        const p = trace.route[i]!,
          q = trace.route[i + 1]
        if (p.route_type === "wire" && p.width_interpolation_mode) {
          unsupported = true
          continue
        }
        if (p.route_type === "via") {
          // A materialized barrel is authoritative, including blind/buried spans.
          if (!emittedVias.some((v) => distance(v, p) <= EPSILON))
            barrel(p, [p.from_layer, p.to_layer], trace.pcb_trace_id)
        } else if (p.route_type === "through_pad") {
          if (p.start_layer === p.end_layer)
            addSegment(
              p.start,
              p.end,
              p.start_layer,
              p.width,
              trace.pcb_trace_id,
            )
          else if (distance(p.start, p.end) <= EPSILON)
            barrel(p.start, [p.start_layer, p.end_layer], trace.pcb_trace_id)
          else unsupported = true
        }
        if (!q) continue
        const a = p.route_type === "through_pad" ? p.end : p
        const b = q.route_type === "through_pad" ? q.start : q
        const al =
          p.route_type === "wire"
            ? p.layer
            : p.route_type === "via"
              ? p.to_layer
              : p.end_layer
        const bl =
          q.route_type === "wire"
            ? q.layer
            : q.route_type === "via"
              ? q.from_layer
              : q.start_layer
        if (al !== bl) continue // No barrel means no physical layer connection.
        const width =
          p.route_type === "via"
            ? q.route_type === "via"
              ? 0
              : q.width
            : p.width
        addSegment(a, b, al, width, trace.pcb_trace_id)
      }
    }
    // Split at crossings and contacts, including T junctions in segment interiors.
    const contacts: { a: Point; b: Point; layer: LayerRef }[] = []
    if (segments.length) {
      const spatial = new Flatbush(segments.length)
      for (const s of segments) {
        const r = s.width / 2 + EPSILON
        spatial.add(
          Math.min(s.a.x, s.b.x) - r,
          Math.min(s.a.y, s.b.y) - r,
          Math.max(s.a.x, s.b.x) + r,
          Math.max(s.a.y, s.b.y) + r,
        )
      }
      spatial.finish()
      for (let i = 0; i < segments.length; i++) {
        const a = segments[i]!,
          r = a.width / 2 + EPSILON
        for (const j of spatial.search(
          Math.min(a.a.x, a.b.x) - r,
          Math.min(a.a.y, a.b.y) - r,
          Math.max(a.a.x, a.b.x) + r,
          Math.max(a.a.y, a.b.y) + r,
        )) {
          if (j <= i) continue
          const b = segments[j]!
          if (a.layer !== b.layer) continue
          const ax = a.b.x - a.a.x,
            ay = a.b.y - a.a.y,
            bx = b.b.x - b.a.x,
            by = b.b.y - b.a.y
          const denominator = ax * by - ay * bx
          if (Math.abs(denominator) > EPSILON) {
            const dx = b.a.x - a.a.x,
              dy = b.a.y - a.a.y
            const t = (dx * by - dy * bx) / denominator,
              u = (dx * ay - dy * ax) / denominator
            if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
              a.cuts.push(t)
              b.cuts.push(u)
            }
          }
          for (const [s, other] of [
            [a, b],
            [b, a],
          ] as const)
            for (const t of [0, 1]) {
              const p = interpolate(s, t),
                projected = project(p, other)
              if (
                distance(p, projected.point) <=
                (s.width + other.width) / 2 + EPSILON
              ) {
                other.cuts.push(projected.t)
                contacts.push({ a: p, b: projected.point, layer: s.layer })
              }
            }
        }
      }
      // Via centres and pad centres are additional physical junctions. Pad
      // escapes may join at an off-centre point inside the pad's copper.
      for (const s of segments) {
        for (const via of emittedVias) {
          if (!via.layers.includes(s.layer)) continue
          const p = project(via, s)
          if (
            distance(via, p.point) <=
            (via.outer_diameter + s.width) / 2 + EPSILON
          ) {
            s.cuts.push(p.t)
            contacts.push({ a: via, b: p.point, layer: s.layer })
          }
        }
        for (const port of ports) {
          const portPads = pads.filter(
            (p) => p.pcb_port_id === port.pcb_port_id,
          )
          const projected = project(port, s)
          const touches = portPads.length
            ? portPads.some(
                (p) =>
                  (p.type === "pcb_smtpad"
                    ? p.layer === s.layer
                    : p.layers.includes(s.layer)) &&
                  isPointInPad(projected.point, p),
              )
            : port.layers.includes(s.layer) &&
              distance(port, projected.point) <= EPSILON
          if (touches) s.cuts.push(projected.t)
        }
      }
    }
    for (const s of segments) {
      const cuts = [...new Set(s.cuts)].sort((a, b) => a - b)
      for (let i = 1; i < cuts.length; i++) {
        const a = interpolate(s, cuts[i - 1]!),
          b = interpolate(s, cuts[i]!)
        edge(node(a, s.layer), node(b, s.layer), {
          length: distance(a, b),
          traceId: s.traceId,
        })
      }
    }
    for (const c of contacts)
      edge(node(c.a, c.layer), node(c.b, c.layer), {
        length: distance(c.a, c.b),
      })
    for (const via of emittedVias) {
      if (
        via.layers.some((layer) =>
          nodeIdsByPosition.has(
            `${via.x.toFixed(7)},${via.y.toFixed(7)},${layer}`,
          ),
        )
      )
        barrel(
          via,
          via.layers.filter((layer) =>
            nodeIdsByPosition.has(
              `${via.x.toFixed(7)},${via.y.toFixed(7)},${layer}`,
            ),
          ),
          via.pcb_trace_id,
          via.pcb_via_id,
        )
    }
    const portNodes = new Map<PcbPortId, number[]>()
    for (const port of ports) {
      const portPads = pads.filter((p) => p.pcb_port_id === port.pcb_port_id)
      const layers = portPads.length
        ? [
            ...new Set(
              portPads.flatMap((p) =>
                p.type === "pcb_smtpad" ? [p.layer] : p.layers,
              ),
            ),
          ]
        : port.layers
      const terminals = layers.map((layer) => node(port, layer))
      portNodes.set(port.pcb_port_id, terminals)
      if (portPads.some((p) => p.type === "pcb_plated_hole"))
        barrel(port, layers)
      for (let id = 0; id < nodes.length; id++) {
        const n = nodes[id]!
        const terminal = terminals.find((t) => nodes[t]!.layer === n.layer)
        if (terminal === undefined) continue
        if (
          portPads.some(
            (p) =>
              (p.type === "pcb_smtpad"
                ? p.layer === n.layer
                : p.layers.includes(n.layer)) && isPointInPad(n.point, p),
          )
        )
          edge(terminal, id, {
            length: distance(port, n.point),
            uncertain: portPads.some((p) => p.shape === "polygon")
              ? "Path through polygon pad copper is unresolved"
              : undefined,
          })
      }
    }
    const pours = circuit
      .filter((e) => e.type === "pcb_copper_pour")
      .filter((e) => sameNetwork(e.source_net_id))
    const unresolvedPlane = circuit.some(
      (e) =>
        (e.type === "pcb_ground_plane" ||
          e.type === "source_pcb_ground_plane") &&
        sameNetwork(e.source_net_id),
    )
    const pourTraceIds = new Set<PcbTraceId>()
    if (pours.length) {
      pourContacts ??= getViaAndPourConnections(circuit)
      const physical = new ConnectivityMap({})
      physical.addConnections(pourContacts)
      for (const trace of traces)
        if (
          pours.some((p) =>
            physical.areIdsConnected(trace.pcb_trace_id, p.pcb_copper_pour_id),
          )
        )
          pourTraceIds.add(trace.pcb_trace_id)
      // SMT pads may reach a pour with no routed wire. This still cannot provide
      // a unique length. It must not turn a missing wire into a zero-length path.
    }
    return {
      nodes,
      portNodes,
      ports,
      unsupported,
      unresolvedPlane,
      pourTraceIds,
      hasPours: pours.length > 0,
    }
  }

  return (source: SourceTrace): PcbTracePathMeasurement => {
    const ownTraces = tracesBySource.get(source.source_trace_id) ?? []
    if (!ownTraces.length)
      return {
        status: "indeterminate",
        reason: "No routed copper is available",
      }
    // Old JSON can carry a router-authored length but no endpoint geometry.
    // A single route is usable; several branches can never be added together.
    if (
      !source.connected_source_port_ids.length ||
      (ownTraces.length === 1 && !ownTraces[0]!.route.length)
    ) {
      if (
        ownTraces.length !== 1 ||
        source.max_length_origin === "inferred_decoupling" ||
        source.max_length_origin === "configured_capacitor"
      )
        return {
          status: "indeterminate",
          reason: "Endpoint path geometry is unavailable",
        }
      const trace = ownTraces[0]!
      if (trace.route.some((p) => p.route_type !== "wire"))
        return {
          status: "indeterminate",
          reason: "Barrel or pad geometry is unavailable",
        }
      if (
        trace.route.length === 1 ||
        trace.route.some(
          (p, i) =>
            i > 0 &&
            p.route_type === "wire" &&
            trace.route[i - 1]?.route_type === "wire" &&
            p.layer !==
              (
                trace.route[i - 1] as Extract<
                  PcbTrace["route"][number],
                  { route_type: "wire" }
                >
              ).layer,
        )
      )
        return {
          status: "indeterminate",
          reason: "Single-route geometry has no continuous physical path",
        }
      const length = trace.route.length
        ? getPcbTraceLength({ ...trace, trace_length: undefined })
        : getPcbTraceLength(trace)
      if (
        !Number.isFinite(length) ||
        (!trace.route.length && trace.trace_length === undefined)
      )
        return {
          status: "indeterminate",
          reason: "Route length is unavailable",
        }
      return {
        status: "measured",
        length,
        pcbTraceIds: [trace.pcb_trace_id],
        pcbViaIds: [],
        method: "authored_route_length",
      }
    }
    if (source.connected_source_port_ids.length > 2)
      return {
        status: "indeterminate",
        reason: "A multi-terminal length rule needs an explicit endpoint pair",
      }
    const network =
      source.max_length_origin === "explicit"
        ? `authored:${source.source_trace_id}`
        : (networkOf(source.source_trace_id) ?? source.source_trace_id)
    let graph = graphCache.get(network)
    if (!graph) {
      graph = buildGraph(source)
      graphCache.set(network, graph)
    }
    const { nodes, ports, portNodes } = graph
    const sourcePorts = ports.filter(
      (p) => p.source_port_id === source.connected_source_port_ids[0],
    )
    const targetPorts = ports.filter((p) =>
      source.connected_source_port_ids.length === 2
        ? p.source_port_id === source.connected_source_port_ids[1]
        : !source.connected_source_port_ids.includes(p.source_port_id!),
    )
    const starts = sourcePorts
      .flatMap((p) => portNodes.get(p.pcb_port_id) ?? [])
      .filter((id) => nodes[id]!.arcs.length > 0)
    const targets = new Set(
      targetPorts
        .flatMap((p) => portNodes.get(p.pcb_port_id) ?? [])
        .filter((id) => nodes[id]!.arcs.length > 0),
    )
    if (!starts.length || !targets.size)
      return {
        status: "indeterminate",
        reason:
          graph.hasPours || graph.unresolvedPlane
            ? "Plane return has no identified local endpoint path"
            : "Physical endpoint records are unavailable",
      }
    if (graph.unresolvedPlane && source.max_length_origin !== "explicit")
      return {
        status: "indeterminate",
        reason: "Ground-plane geometry and local return path are unresolved",
      }
    if (graph.unsupported)
      return {
        status: "indeterminate",
        reason: "The network contains unsupported path geometry",
      }
    // Dijkstra is scoped to the selected logical network. The queue contains
    // only reached graph nodes; a branch contributes only if it is on the path.
    const best = new Map<number, number>(),
      previous = new Map<number, { node: number; arc: Arc }>()
    const pending: { node: number; length: number }[] = []
    const push = (entry: { node: number; length: number }) => {
      pending.push(entry)
      let i = pending.length - 1
      while (i > 0) {
        const parent = (i - 1) >> 1
        if (pending[parent]!.length <= entry.length) break
        pending[i] = pending[parent]!
        i = parent
      }
      pending[i] = entry
    }
    const pop = () => {
      const first = pending[0]!,
        last = pending.pop()!
      if (pending.length) {
        let i = 0
        while (i * 2 + 1 < pending.length) {
          let child = i * 2 + 1
          if (
            child + 1 < pending.length &&
            pending[child + 1]!.length < pending[child]!.length
          )
            child++
          if (pending[child]!.length >= last.length) break
          pending[i] = pending[child]!
          i = child
        }
        pending[i] = last
      }
      return first
    }
    for (const start of starts) {
      best.set(start, 0)
      push({ node: start, length: 0 })
    }
    let end: number | undefined
    while (pending.length) {
      const current = pop()
      if (current.length !== best.get(current.node)) continue
      if (targets.has(current.node)) {
        end = current.node
        break
      }
      for (const arc of nodes[current.node]!.arcs) {
        const length = current.length + arc.length
        if (length >= (best.get(arc.to) ?? Infinity)) continue
        best.set(arc.to, length)
        previous.set(arc.to, { node: current.node, arc })
        push({ node: arc.to, length })
      }
    }
    if (end === undefined)
      return {
        status: "indeterminate",
        reason: graph.hasPours
          ? "Return may use connected plane copper; no routed endpoint path is resolved"
          : "No continuous physical endpoint path is resolved",
      }
    const path: Arc[] = []
    let current = end
    while (previous.has(current)) {
      const step = previous.get(current)!
      path.push(step.arc)
      current = step.node
    }
    // A pour reachable from this endpoint may provide a different return path.
    // No aggregate, Euclidean shortcut, or arbitrary current path is substituted.
    if (graph.pourTraceIds.size && source.max_length_origin !== "explicit") {
      const reached = new Set<number>(),
        queue = [...starts]
      while (queue.length) {
        const id = queue.pop()!
        if (reached.has(id)) continue
        reached.add(id)
        for (const arc of nodes[id]!.arcs) {
          if (arc.traceId && graph.pourTraceIds.has(arc.traceId))
            return {
              status: "indeterminate",
              reason:
                "Connected plane copper has no uniquely measurable routed return path",
            }
          queue.push(arc.to)
        }
      }
    }
    const pcbTraceIds = [
      ...new Set(path.flatMap((arc) => (arc.traceId ? [arc.traceId] : []))),
    ].reverse()
    const pcbViaIds = [
      ...new Set(path.flatMap((arc) => (arc.viaId ? [arc.viaId] : []))),
    ].reverse()
    const uncertain = path.find((arc) => arc.uncertain)?.uncertain
    if (uncertain)
      return {
        status: "indeterminate",
        reason: uncertain,
        knownPathLengthLowerBound: best.get(end)!,
        pcbTraceIds,
        pcbViaIds,
      }
    return {
      status: "measured",
      length: best.get(end)!,
      pcbTraceIds: [
        ...new Set(path.flatMap((arc) => (arc.traceId ? [arc.traceId] : []))),
      ].reverse(),
      pcbViaIds: [
        ...new Set(path.flatMap((arc) => (arc.viaId ? [arc.viaId] : []))),
      ].reverse(),
      method: "shortest_copper_path",
    }
  }
}
