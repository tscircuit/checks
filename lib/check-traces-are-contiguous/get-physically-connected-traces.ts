import type { PcbPort, PcbTrace } from "circuit-json"
import type { PcbConnectivityMap } from "circuit-json-to-connectivity-map"
import {
  routePointTouchesPad,
  type PcbPad,
} from "../util/route-point-touches-pad"

type PcbPortId = PcbPort["pcb_port_id"]
type PcbTraceId = PcbTrace["pcb_trace_id"]

interface TraceConnectivityContext {
  pcbTraces: PcbTrace[]
  pcbConnectivityMap: PcbConnectivityMap
  touchedPortIdsByTraceId: Map<PcbTraceId, Set<PcbPortId>>
  traceIdsByTouchedPortId: Map<PcbPortId, Set<PcbTraceId>>
  physicallyConnectedTracesByTraceId: Map<PcbTraceId, PcbTrace[]>
}

export function createTraceConnectivityContext({
  pcbTraces,
  padMap,
  pcbConnectivityMap,
}: {
  pcbTraces: PcbTrace[]
  padMap: Map<PcbPortId, PcbPad[]>
  pcbConnectivityMap: PcbConnectivityMap
}): TraceConnectivityContext {
  const touchedPortIdsByTraceId = new Map<PcbTraceId, Set<PcbPortId>>()
  const traceIdsByTouchedPortId = new Map<PcbPortId, Set<PcbTraceId>>()

  // Route attribution can change when a logical net is converted into an MST.
  // Record the PCB ports each routed trace physically reaches so contiguity can
  // follow the copper network instead of relying on singular source_trace_ids.
  for (const trace of pcbTraces) {
    const touchedPortIds = new Set<PcbPortId>()
    const firstPoint = trace.route[0]
    const lastPoint = trace.route.at(-1)

    for (const point of [firstPoint, lastPoint]) {
      if (!point) continue

      for (const [pcbPortId, pads] of padMap) {
        if (pads.some((pad) => routePointTouchesPad(point, pad))) {
          touchedPortIds.add(pcbPortId)
        }
      }
    }

    touchedPortIdsByTraceId.set(trace.pcb_trace_id, touchedPortIds)
    for (const pcbPortId of touchedPortIds) {
      const traceIds = traceIdsByTouchedPortId.get(pcbPortId) ?? new Set()
      traceIds.add(trace.pcb_trace_id)
      traceIdsByTouchedPortId.set(pcbPortId, traceIds)
    }
  }

  const physicallyConnectedTracesByTraceId = new Map<PcbTraceId, PcbTrace[]>()
  return {
    pcbTraces,
    pcbConnectivityMap,
    touchedPortIdsByTraceId,
    traceIdsByTouchedPortId,
    physicallyConnectedTracesByTraceId,
  }
}

export function getPhysicallyConnectedTraces(
  startTrace: PcbTrace,
  ctx: TraceConnectivityContext,
): PcbTrace[] {
  const {
    pcbTraces,
    pcbConnectivityMap,
    touchedPortIdsByTraceId,
    traceIdsByTouchedPortId,
    physicallyConnectedTracesByTraceId,
  } = ctx
  const cached = physicallyConnectedTracesByTraceId.get(startTrace.pcb_trace_id)
  if (cached) return cached

  const connectedTraceIds = new Set<PcbTraceId>()
  const pendingTraceIds = [startTrace.pcb_trace_id]

  while (pendingTraceIds.length > 0) {
    const traceId = pendingTraceIds.pop()!
    if (connectedTraceIds.has(traceId)) continue
    connectedTraceIds.add(traceId)

    for (const connectedTrace of pcbConnectivityMap.getAllTracesConnectedToTrace(
      traceId,
    )) {
      if (!connectedTraceIds.has(connectedTrace.pcb_trace_id)) {
        pendingTraceIds.push(connectedTrace.pcb_trace_id)
      }
    }

    for (const pcbPortId of touchedPortIdsByTraceId.get(traceId) ?? []) {
      for (const touchingTraceId of traceIdsByTouchedPortId.get(pcbPortId) ??
        []) {
        if (!connectedTraceIds.has(touchingTraceId)) {
          pendingTraceIds.push(touchingTraceId)
        }
      }
    }
  }

  const connectedTraces = pcbTraces.filter((trace) =>
    connectedTraceIds.has(trace.pcb_trace_id),
  )
  for (const trace of connectedTraces) {
    physicallyConnectedTracesByTraceId.set(trace.pcb_trace_id, connectedTraces)
  }
  return connectedTraces
}
