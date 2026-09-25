import type {
  AnyCircuitElement,
  PcbPort,
  PcbTrace,
  PcbTraceError,
  SourceTrace,
} from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { getReadableNameForPcbTrace } from "@tscircuit/circuit-json-util"
import { routePointTouchesPad } from "../util/route-point-touches-pad"
import {
  createEndpointContactContext,
  endpointTouchesNetCopper,
  getTerminalWireSegment,
  type EndpointContactContext,
  type PcbTraceWireRoutePoint,
  type TraceEndpoint,
} from "./endpoint-contact"
import { CONTACT_EPSILON_MM } from "./types"

type SourceTraceId = SourceTrace["source_trace_id"]
type SourcePortId = PcbPort["source_port_id"]

interface DanglingEndpoint {
  endpoint: TraceEndpoint
  point: PcbTraceWireRoutePoint
}

function isEndpointDangling(
  {
    trace,
    endpoint,
    point,
    hasExpectedPorts,
  }: DanglingEndpoint & { trace: PcbTrace; hasExpectedPorts: boolean },
  ctx: EndpointContactContext,
): boolean {
  if (ctx.portPads.some((pad) => routePointTouchesPad(point, pad))) {
    return false
  }
  const terminalSegment = getTerminalWireSegment(trace, endpoint)
  if (!terminalSegment) {
    // Port-connected via-only fragments have no lateral wire end to inspect.
    return !hasExpectedPorts
  }
  return !endpointTouchesNetCopper({ trace, point, terminalSegment }, ctx)
}

function getDanglingEndpoints(
  { trace, hasExpectedPorts }: { trace: PcbTrace; hasExpectedPorts: boolean },
  ctx: EndpointContactContext,
): DanglingEndpoint[] {
  const routeEndpoints = [
    { endpoint: "start" as const, point: trace.route[0]! },
    { endpoint: "end" as const, point: trace.route[trace.route.length - 1]! },
  ]
  const danglingEndpoints: DanglingEndpoint[] = []
  for (const { endpoint, point } of routeEndpoints) {
    if (point.route_type !== "wire") continue
    if (isEndpointDangling({ trace, endpoint, point, hasExpectedPorts }, ctx)) {
      danglingEndpoints.push({ endpoint, point })
    }
  }

  // A closed loop's shared start and end point is reported once.
  const [start, end] = danglingEndpoints
  if (
    start &&
    end &&
    start.point.layer === end.point.layer &&
    Math.hypot(start.point.x - end.point.x, start.point.y - end.point.y) <=
      CONTACT_EPSILON_MM
  ) {
    danglingEndpoints.pop()
  }
  return danglingEndpoints
}

/** Reports exposed trace endpoints, independently of required-port connectivity. */
export function checkDanglingTraces(
  circuitJson: AnyCircuitElement[],
  options: { connMap?: ConnectivityMap } = {},
): PcbTraceError[] {
  const ctx = createEndpointContactContext(circuitJson, options.connMap)
  const sourceTracesById = new Map<SourceTraceId, SourceTrace>()
  const sourcePortIdsWithPcbPorts = new Set<SourcePortId>()
  for (const element of circuitJson) {
    if (element.type === "source_trace") {
      sourceTracesById.set(element.source_trace_id, element)
    }
    if (element.type === "pcb_port") {
      sourcePortIdsWithPcbPorts.add(element.source_port_id)
    }
  }

  const errors: PcbTraceError[] = []
  for (const trace of circuitJson) {
    if (trace.type !== "pcb_trace" || trace.route.length === 0) continue
    // Marked antenna copper has intentional open ends; feed traces remain checked.
    if (trace.is_antenna_trace === true) continue

    let hasExpectedPorts = false
    if (trace.source_trace_id) {
      const sourceTrace = sourceTracesById.get(trace.source_trace_id)
      hasExpectedPorts = Boolean(
        sourceTrace?.connected_source_port_ids.some((sourcePortId) =>
          sourcePortIdsWithPcbPorts.has(sourcePortId),
        ),
      )
    }

    for (const { endpoint, point } of getDanglingEndpoints(
      { trace, hasExpectedPorts },
      ctx,
    )) {
      const traceName = getReadableNameForPcbTrace(
        circuitJson,
        trace.pcb_trace_id,
      )
      errors.push({
        type: "pcb_trace_error",
        error_type: "pcb_trace_error",
        pcb_trace_error_id: `disconnected_endpoint_${trace.pcb_trace_id}_${endpoint}`,
        message: `Trace [${traceName}] has dangling endpoint at (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`,
        source_trace_id: trace.source_trace_id || `!${trace.pcb_trace_id}`,
        pcb_trace_id: trace.pcb_trace_id,
        center: { x: point.x, y: point.y },
        pcb_component_ids: [],
        pcb_port_ids: [],
      })
    }
  }
  return errors
}
