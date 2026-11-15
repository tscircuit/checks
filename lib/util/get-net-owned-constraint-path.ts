import type { PcbTrace, PcbTraceRoutePoint } from "circuit-json"
import { getPcbTraceLength } from "./get-pcb-trace-length"

type Wire = Extract<PcbTraceRoutePoint, { route_type: "wire" }>
type Edge = {
  from: string
  to: string
  trace: PcbTrace
  route: PcbTraceRoutePoint[]
  length: number
}
type Node = { edges: Edge[]; ports: Set<string> }

/** Measure the shortest existing copper path between constrained terminals.
 * A terminal-to-net rule ends at the nearest other referenced PCB terminal.
 * Shared route vertices join fragments only on the same layer; vias provide
 * explicit layer changes. Selecting edges excludes dangling and other-net
 * branches, including branches in a PCB trace that also contains the path.
 */
export const getNetOwnedConstraintPath = (
  traces: PcbTrace[],
  endpointSets: Set<string>[],
): PcbTrace[] => {
  const nodes = new Map<string, Node>()
  const edges: Edge[] = []
  const getNode = (point: Wire): string => {
    const key = `${point.layer}:${point.x.toFixed(6)}:${point.y.toFixed(6)}`
    let node = nodes.get(key)
    if (!node) {
      node = { edges: [], ports: new Set() }
      nodes.set(key, node)
    }
    if (point.start_pcb_port_id) node.ports.add(point.start_pcb_port_id)
    if (point.end_pcb_port_id) node.ports.add(point.end_pcb_port_id)
    return key
  }
  const addEdge = (
    trace: PcbTrace,
    start: Wire,
    end: Wire,
    route: PcbTraceRoutePoint[],
  ): void => {
    const from = getNode(start)
    const to = getNode(end)
    if (from === to) return
    const edge: Edge = {
      from,
      to,
      trace,
      route,
      length: getPcbTraceLength({ ...trace, trace_length: undefined, route }),
    }
    nodes.get(from)!.edges.push(edge)
    nodes.get(to)!.edges.push(edge)
    edges.push(edge)
  }

  for (const trace of traces) {
    let previous: Wire | undefined
    const firstEdge = edges.length
    for (const point of trace.route) {
      const start: Wire =
        point.route_type === "wire"
          ? point
          : {
              route_type: "wire",
              ...(point.route_type === "through_pad"
                ? point.start
                : { x: point.x, y: point.y }),
              layer:
                point.route_type === "through_pad"
                  ? point.start_layer
                  : point.from_layer,
              width:
                point.route_type === "through_pad"
                  ? point.width
                  : (previous?.width ?? 0),
            }
      const end: Wire =
        point.route_type === "wire"
          ? point
          : {
              ...start,
              ...(point.route_type === "through_pad"
                ? point.end
                : { x: point.x, y: point.y }),
              layer:
                point.route_type === "through_pad"
                  ? point.end_layer
                  : point.to_layer,
            }
      getNode(start)
      if (previous?.layer === start.layer)
        addEdge(trace, previous, start, [previous, start])
      if (point.route_type !== "wire") addEdge(trace, start, end, [point])
      previous = end
    }
    // Preserve a router-supplied length while allowing a path to use only part
    // of that trace. Fragment exports should supply their own fragment length.
    if (trace.trace_length !== undefined) {
      const traceEdges = edges.slice(firstEdge)
      const measured = traceEdges.reduce((sum, edge) => sum + edge.length, 0)
      if (measured > 0) {
        for (const edge of traceEdges)
          edge.length *= trace.trace_length / measured
      }
    }
  }

  const starts = new Set(
    [...nodes]
      .filter(([, node]) =>
        [...node.ports].some((port) => endpointSets[0]!.has(port)),
      )
      .map(([id]) => id),
  )
  if (starts.size === 0) return []
  const targetSets =
    endpointSets.length > 1
      ? endpointSets.slice(1)
      : [
          new Set(
            [...nodes.values()]
              .flatMap((node) => [...node.ports])
              .filter((port) => !endpointSets[0]!.has(port)),
          ),
        ]
  const selected = new Set<Edge>()
  for (const targets of targetSets) {
    const path = findPath(nodes, starts, targets)
    if (!path) return []
    for (const edge of path) selected.add(edge)
  }

  // These measured portions retain the original PCB trace references for
  // diagnostics. Only selected segments and vias contribute to either check.
  const portions = new Map<PcbTrace, PcbTrace>()
  for (const edge of edges) {
    if (!selected.has(edge)) continue
    let portion = portions.get(edge.trace)
    if (!portion) {
      portion = { ...edge.trace, trace_length: 0, route: [] }
      portions.set(edge.trace, portion)
    }
    portion.trace_length! += edge.length
    portion.route.push(...edge.route)
  }
  return [...portions.values()]
}

const findPath = (
  nodes: Map<string, Node>,
  starts: Set<string>,
  targetPorts: Set<string>,
): Edge[] | undefined => {
  const distances = new Map([...starts].map((id) => [id, 0]))
  const pending = new Set(starts)
  const previous = new Map<string, { node: string; edge: Edge }>()
  while (pending.size > 0) {
    let current = pending.values().next().value!
    for (const candidate of pending) {
      if (distances.get(candidate)! < distances.get(current)!)
        current = candidate
    }
    pending.delete(current)
    const node = nodes.get(current)!
    if ([...node.ports].some((port) => targetPorts.has(port))) {
      const path: Edge[] = []
      while (!starts.has(current)) {
        const step = previous.get(current)!
        path.push(step.edge)
        current = step.node
      }
      return path
    }
    for (const edge of node.edges) {
      const next = edge.from === current ? edge.to : edge.from
      const distance = distances.get(current)! + edge.length
      if (distance >= (distances.get(next) ?? Number.POSITIVE_INFINITY))
        continue
      distances.set(next, distance)
      previous.set(next, { node: current, edge })
      pending.add(next)
    }
  }
  return undefined
}
