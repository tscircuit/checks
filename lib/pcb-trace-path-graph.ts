import type { PcbPort, PcbTrace, PcbTraceRoutePoint } from "circuit-json"
import {
  getSegmentIntersection,
  pointToSegmentDistance,
} from "@tscircuit/math-utils"

const DEFAULT_VIA_LENGTH_MM = 1.6
const POINT_EPSILON = 1e-6

type CopperLayer = Extract<PcbTraceRoutePoint, { route_type: "wire" }>["layer"]

interface LayerPoint {
  x: number
  y: number
  layer: CopperLayer
}

interface PlanarSegment {
  start: LayerPoint
  end: LayerPoint
  pcbTraceId: string
}

interface GraphEdge {
  toNodeId: string
  length: number
  pcbTraceId?: string
}

export interface PcbTracePathGraph {
  adjacency: Map<string, GraphEdge[]>
  pcbPortNodeIds: Map<string, string>
}

export interface PcbTracePath {
  length: number
  pcbTraceIds: string[]
}

const getPointDistance = (
  pointA: { x: number; y: number },
  pointB: { x: number; y: number },
) => Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y)

const getNodeId = ({ x, y, layer }: LayerPoint) => {
  const normalizedX = Math.abs(x) < POINT_EPSILON ? 0 : x
  const normalizedY = Math.abs(y) < POINT_EPSILON ? 0 : y
  return `${layer}:${normalizedX.toFixed(6)}:${normalizedY.toFixed(6)}`
}

const addGraphEdge = (
  adjacency: Map<string, GraphEdge[]>,
  fromNodeId: string,
  toNodeId: string,
  length: number,
  pcbTraceId?: string,
) => {
  if (!adjacency.has(fromNodeId)) adjacency.set(fromNodeId, [])
  if (!adjacency.has(toNodeId)) adjacency.set(toNodeId, [])
  if (fromNodeId === toNodeId) return

  adjacency.get(fromNodeId)!.push({ toNodeId, length, pcbTraceId })
  adjacency.get(toNodeId)!.push({
    toNodeId: fromNodeId,
    length,
    pcbTraceId,
  })
}

const addSegmentIntersections = (
  segments: PlanarSegment[],
  splitPointsBySegment: Array<Map<string, LayerPoint>>,
) => {
  const addSplitPoint = (segmentIndex: number, point: LayerPoint) => {
    splitPointsBySegment[segmentIndex]!.set(getNodeId(point), point)
  }

  for (
    let firstSegmentIndex = 0;
    firstSegmentIndex < segments.length;
    firstSegmentIndex++
  ) {
    const firstSegment = segments[firstSegmentIndex]!
    for (
      let secondSegmentIndex = firstSegmentIndex + 1;
      secondSegmentIndex < segments.length;
      secondSegmentIndex++
    ) {
      const secondSegment = segments[secondSegmentIndex]!
      if (firstSegment.start.layer !== secondSegment.start.layer) continue

      const intersection = getSegmentIntersection(
        firstSegment.start,
        firstSegment.end,
        secondSegment.start,
        secondSegment.end,
      )
      if (intersection) {
        const layer = firstSegment.start.layer
        addSplitPoint(firstSegmentIndex, { ...intersection, layer })
        addSplitPoint(secondSegmentIndex, { ...intersection, layer })
      }

      for (const point of [firstSegment.start, firstSegment.end]) {
        if (
          pointToSegmentDistance(
            point,
            secondSegment.start,
            secondSegment.end,
          ) <= POINT_EPSILON
        ) {
          addSplitPoint(secondSegmentIndex, point)
        }
      }
      for (const point of [secondSegment.start, secondSegment.end]) {
        if (
          pointToSegmentDistance(point, firstSegment.start, firstSegment.end) <=
          POINT_EPSILON
        ) {
          addSplitPoint(firstSegmentIndex, point)
        }
      }
    }
  }
}

export const buildPcbTracePathGraph = (
  pcbTraces: PcbTrace[],
  pcbPorts: PcbPort[],
  { viaLength = DEFAULT_VIA_LENGTH_MM }: { viaLength?: number } = {},
): PcbTracePathGraph => {
  const adjacency = new Map<string, GraphEdge[]>()
  const segments: PlanarSegment[] = []
  const copperNodeIdsByPortId = new Map<string, Set<string>>()

  const associatePort = (pcbPortId: string, point: LayerPoint) => {
    const nodeIds = copperNodeIdsByPortId.get(pcbPortId) ?? new Set<string>()
    nodeIds.add(getNodeId(point))
    copperNodeIdsByPortId.set(pcbPortId, nodeIds)
  }

  for (const pcbTrace of pcbTraces) {
    for (const routePoint of pcbTrace.route) {
      if (routePoint.route_type === "wire") {
        const point = {
          x: routePoint.x,
          y: routePoint.y,
          layer: routePoint.layer,
        }
        const nodeId = getNodeId(point)
        if (!adjacency.has(nodeId)) adjacency.set(nodeId, [])
        if (routePoint.start_pcb_port_id) {
          associatePort(routePoint.start_pcb_port_id, point)
        }
        if (routePoint.end_pcb_port_id) {
          associatePort(routePoint.end_pcb_port_id, point)
        }
      } else if (routePoint.route_type === "via") {
        addGraphEdge(
          adjacency,
          getNodeId({
            x: routePoint.x,
            y: routePoint.y,
            layer: routePoint.from_layer,
          }),
          getNodeId({
            x: routePoint.x,
            y: routePoint.y,
            layer: routePoint.to_layer,
          }),
          viaLength,
          pcbTrace.pcb_trace_id,
        )
      }
    }

    for (
      let pointIndex = 0;
      pointIndex < pcbTrace.route.length - 1;
      pointIndex++
    ) {
      const start = pcbTrace.route[pointIndex]
      const end = pcbTrace.route[pointIndex + 1]
      if (start?.route_type !== "wire" || end?.route_type !== "wire") continue
      if (start.layer !== end.layer) continue
      if (getPointDistance(start, end) <= POINT_EPSILON) continue
      segments.push({ start, end, pcbTraceId: pcbTrace.pcb_trace_id })
    }
  }

  const splitPointsBySegment = segments.map(
    (segment) =>
      new Map<string, LayerPoint>([
        [getNodeId(segment.start), segment.start],
        [getNodeId(segment.end), segment.end],
      ]),
  )
  addSegmentIntersections(segments, splitPointsBySegment)

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
    const segment = segments[segmentIndex]!
    const deltaX = segment.end.x - segment.start.x
    const deltaY = segment.end.y - segment.start.y
    const lengthSquared = deltaX * deltaX + deltaY * deltaY
    const splitPoints = [...splitPointsBySegment[segmentIndex]!.values()].sort(
      (pointA, pointB) =>
        ((pointA.x - segment.start.x) * deltaX +
          (pointA.y - segment.start.y) * deltaY) /
          lengthSquared -
        ((pointB.x - segment.start.x) * deltaX +
          (pointB.y - segment.start.y) * deltaY) /
          lengthSquared,
    )

    for (
      let pointIndex = 0;
      pointIndex < splitPoints.length - 1;
      pointIndex++
    ) {
      const start = splitPoints[pointIndex]!
      const end = splitPoints[pointIndex + 1]!
      addGraphEdge(
        adjacency,
        getNodeId(start),
        getNodeId(end),
        getPointDistance(start, end),
        segment.pcbTraceId,
      )
    }
  }

  const pcbPortNodeIds = new Map<string, string>()
  for (const pcbPort of pcbPorts) {
    const copperNodeIds = copperNodeIdsByPortId.get(pcbPort.pcb_port_id)
    if (!copperNodeIds?.size) continue
    const pcbPortNodeId = `pcb_port:${pcbPort.pcb_port_id}`
    pcbPortNodeIds.set(pcbPort.pcb_port_id, pcbPortNodeId)
    for (const copperNodeId of copperNodeIds) {
      addGraphEdge(adjacency, pcbPortNodeId, copperNodeId, 0)
    }
  }

  return { adjacency, pcbPortNodeIds }
}

export const getShortestPcbTracePath = (
  graph: PcbTracePathGraph,
  startPcbPortIds: string[],
  endPcbPortIds: string[],
): PcbTracePath | undefined => {
  const startNodeIds = startPcbPortIds
    .map((pcbPortId) => graph.pcbPortNodeIds.get(pcbPortId))
    .filter((nodeId): nodeId is string => Boolean(nodeId))
  const endNodeIds = new Set(
    endPcbPortIds
      .map((pcbPortId) => graph.pcbPortNodeIds.get(pcbPortId))
      .filter((nodeId): nodeId is string => Boolean(nodeId)),
  )
  if (!startNodeIds.length || !endNodeIds.size) return undefined

  const distances = new Map<string, number>()
  const previous = new Map<string, { nodeId: string; pcbTraceId?: string }>()
  const queue: Array<{ nodeId: string; distance: number }> = []
  for (const nodeId of startNodeIds) {
    distances.set(nodeId, 0)
    queue.push({ nodeId, distance: 0 })
  }

  while (queue.length) {
    let shortestIndex = 0
    for (let index = 1; index < queue.length; index++) {
      if (queue[index]!.distance < queue[shortestIndex]!.distance) {
        shortestIndex = index
      }
    }
    const [current] = queue.splice(shortestIndex, 1)
    if (!current || current.distance !== distances.get(current.nodeId)) continue

    if (endNodeIds.has(current.nodeId)) {
      const pcbTraceIds: string[] = []
      let nodeId = current.nodeId
      while (previous.has(nodeId)) {
        const step = previous.get(nodeId)!
        if (step.pcbTraceId && pcbTraceIds[0] !== step.pcbTraceId) {
          pcbTraceIds.unshift(step.pcbTraceId)
        }
        nodeId = step.nodeId
      }
      return { length: current.distance, pcbTraceIds }
    }

    for (const edge of graph.adjacency.get(current.nodeId) ?? []) {
      const nextDistance = current.distance + edge.length
      if (
        nextDistance >=
        (distances.get(edge.toNodeId) ?? Number.POSITIVE_INFINITY)
      ) {
        continue
      }
      distances.set(edge.toNodeId, nextDistance)
      previous.set(edge.toNodeId, {
        nodeId: current.nodeId,
        pcbTraceId: edge.pcbTraceId,
      })
      queue.push({ nodeId: edge.toNodeId, distance: nextDistance })
    }
  }

  return undefined
}
