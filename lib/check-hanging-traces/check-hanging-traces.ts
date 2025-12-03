import type {
  AnyCircuitElement,
  PcbPort,
  PcbTrace,
  PcbTraceError,
  PcbPlatedHole,
  PcbSmtPad,
  SourceTrace,
} from "circuit-json"
import { cju, getReadableNameForElement } from "@tscircuit/circuit-json-util"
import { EPSILON } from "lib/drc-defaults"
import { isPointInPad } from "../check-traces-are-contiguous/is-point-in-pad"
import { onSegment } from "@tscircuit/math-utils"

type TraceEndpoint = {
  trace: PcbTrace
  point: PcbTrace["route"][number]
  layer?: string
  isStart: boolean
}

type TraceSegment = {
  trace: PcbTrace
  x1: number
  y1: number
  x2: number
  y2: number
  layer: string
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y)

const pointsEqual = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => distance(a, b) <= EPSILON

const isPointAtSegmentEndpoint = (
  point: { x: number; y: number },
  segment: TraceSegment,
) =>
  pointsEqual(point, { x: segment.x1, y: segment.y1 }) ||
  pointsEqual(point, { x: segment.x2, y: segment.y2 })

const isPointOnSegment = (
  point: { x: number; y: number },
  segment: TraceSegment,
) =>
  Math.abs(
    (point.y - segment.y1) * (segment.x2 - segment.x1) -
      (point.x - segment.x1) * (segment.y2 - segment.y1),
  ) <= EPSILON &&
  onSegment({ x: segment.x1, y: segment.y1 }, point, {
    x: segment.x2,
    y: segment.y2,
  })

const getTraceSegments = (traces: PcbTrace[]): TraceSegment[] =>
  traces.flatMap((trace) => {
    const segments: TraceSegment[] = []
    for (let i = 0; i < trace.route.length - 1; i++) {
      const start = trace.route[i]
      const end = trace.route[i + 1]
      if (start.route_type !== "wire" || end.route_type !== "wire") continue
      if (start.layer !== end.layer || start.layer === undefined) continue
      segments.push({
        trace,
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        layer: start.layer,
      })
    }
    return segments
  })

const getTraceEndpoints = (traces: PcbTrace[]): TraceEndpoint[] =>
  traces
    .map((trace) => {
      if (trace.route.length === 0) return []
      const firstPoint = trace.route[0]
      const lastPoint = trace.route[trace.route.length - 1]
      return [
        {
          trace,
          point: firstPoint,
          layer: (firstPoint as any).layer as string | undefined,
          isStart: true,
        },
        {
          trace,
          point: lastPoint,
          layer: (lastPoint as any).layer as string | undefined,
          isStart: false,
        },
      ]
    })
    .flat()

const isEndpointConnectedToPort = (
  endpoint: TraceEndpoint,
  pcbPorts: PcbPort[],
  pads: (PcbSmtPad | PcbPlatedHole)[],
) => {
  const point = endpoint.point as {
    x: number
    y: number
    start_pcb_port_id?: string
    end_pcb_port_id?: string
  }
  const explicitPortId = point.start_pcb_port_id || point.end_pcb_port_id
  if (
    explicitPortId &&
    pcbPorts.some((port) => port.pcb_port_id === explicitPortId)
  ) {
    return { connected: true, portId: explicitPortId }
  }

  for (const port of pcbPorts) {
    if (
      endpoint.layer &&
      port.layers &&
      !(port.layers as string[]).includes(endpoint.layer as string)
    )
      continue
    if (pointsEqual(point, { x: port.x, y: port.y })) {
      return { connected: true, portId: port.pcb_port_id }
    }
  }

  for (const pad of pads) {
    if (!pad.pcb_port_id) continue
    if (
      endpoint.layer &&
      "layers" in pad &&
      pad.layers &&
      !(pad.layers as string[]).includes(endpoint.layer as string)
    ) {
      continue
    }
    if (isPointInPad(point, pad)) {
      return { connected: true, portId: pad.pcb_port_id }
    }
  }

  return { connected: false }
}

export const checkHangingTraces = (
  circuitJson: AnyCircuitElement[],
): PcbTraceError[] => {
  const errors: PcbTraceError[] = []
  const pcbTraces = cju(circuitJson).pcb_trace.list()
  const pcbPorts = cju(circuitJson).pcb_port.list()
  const pcbSmtPads = cju(circuitJson).pcb_smtpad.list()
  const pcbPlatedHoles = cju(circuitJson).pcb_plated_hole.list()
  const sourceTraceMap = new Map(
    cju(circuitJson)
      .source_trace.list()
      .map((st: SourceTrace) => [st.source_trace_id, st]),
  )

  const traceSegments = getTraceSegments(pcbTraces)
  const traceEndpoints = getTraceEndpoints(pcbTraces)
  const pads: (PcbSmtPad | PcbPlatedHole)[] = [...pcbSmtPads, ...pcbPlatedHoles]

  for (const endpoint of traceEndpoints) {
    const { trace, point, layer } = endpoint
    const traceName =
      sourceTraceMap.get(trace.source_trace_id || "")?.display_name ||
      trace.source_trace_id ||
      trace.pcb_trace_id ||
      "unknown"
    const pcb_trace_error_id = `hanging_${trace.pcb_trace_id}_${endpoint.isStart ? "start" : "end"}`

    const { connected } = isEndpointConnectedToPort(endpoint, pcbPorts, pads)
    if (connected) continue

    const sharedEndpoint = traceEndpoints.find(
      (other) =>
        other.trace.pcb_trace_id !== trace.pcb_trace_id &&
        (!layer || !other.layer || other.layer === layer) &&
        pointsEqual(point, other.point as { x: number; y: number }),
    )
    if (sharedEndpoint) continue

    const overlappingSegment = traceSegments.find(
      (segment) =>
        segment.trace.pcb_trace_id !== trace.pcb_trace_id &&
        segment.layer === layer &&
        isPointOnSegment(point as { x: number; y: number }, segment) &&
        !isPointAtSegmentEndpoint(point as { x: number; y: number }, segment),
    )

    const source_trace_id =
      trace.source_trace_id ||
      sourceTraceMap.get(trace.source_trace_id || "")?.source_trace_id ||
      `!${trace.pcb_trace_id}`

    const message = overlappingSegment
      ? `Trace [${traceName}] ends along trace ${getReadableNameForElement(
          circuitJson,
          overlappingSegment.trace.pcb_trace_id,
        )} at (${point.x}, ${point.y}) without connecting to a pcb port.`
      : `Trace [${traceName}] has a hanging endpoint at (${point.x}, ${point.y}).`

    errors.push({
      type: "pcb_trace_error",
      message,
      source_trace_id,
      error_type: "pcb_trace_error",
      pcb_trace_id: trace.pcb_trace_id,
      pcb_trace_error_id,
      center: { x: point.x, y: point.y },
      pcb_component_ids: [],
      pcb_port_ids: [],
    })
  }

  return errors
}
