import { createTracePortLayerConnectivity } from "./trace-port-layer-connectivity"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import {
  ConnectivityMap,
  findConnectedNetworks,
  PcbConnectivityMap,
} from "circuit-json-to-connectivity-map"
import Flatbush from "flatbush"
import { getViaAndPourConnections } from "./get-via-and-pour-connections"
import { getTouchingSmtPadConnections } from "./get-touching-smt-pad-connections"

type TraceSegmentBounds = {
  traceIndex: number
  segmentTrace: PcbTrace
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Physical trace connectivity, including plated via barrels and copper pours. */
export function createIndexedPcbConnectivityMap(
  circuitJson: AnyCircuitElement[],
): PcbConnectivityMap {
  // Construct empty to avoid the dependency's all-pairs scan. Keep its exact
  // intersection predicate and query methods, including cross-net contacts.
  const map = new PcbConnectivityMap()
  map.circuitJson = circuitJson
  for (const element of circuitJson) {
    if (element.type === "pcb_trace") {
      map.traceIdToElm.set(element.pcb_trace_id, element)
    } else if (element.type === "pcb_port") {
      map.portIdToElm.set(element.pcb_port_id, element)
    }
  }
  const traces = [...map.traceIdToElm.values()]
  const boundsByLayer = new Map<string, TraceSegmentBounds[]>()
  for (const [traceIndex, trace] of traces.entries()) {
    for (let i = 0; i < trace.route.length - 1; i++) {
      const a = trace.route[i]
      const b = trace.route[i + 1]
      if (
        a.route_type !== "wire" ||
        b.route_type !== "wire" ||
        a.layer !== b.layer
      )
        continue
      // Index individual segments so distant parts of a long trace do not
      // admit unrelated copper to the exact segment intersection predicate.
      // The predicate uses the first point's width for each segment.
      const radius = a.width / 2 + 1e-9
      const entries = boundsByLayer.get(a.layer) ?? []
      entries.push({
        traceIndex,
        segmentTrace: { ...trace, route: [a, b] },
        minX: Math.min(a.x, b.x) - radius,
        minY: Math.min(a.y, b.y) - radius,
        maxX: Math.max(a.x, b.x) + radius,
        maxY: Math.max(a.y, b.y) + radius,
      })
      boundsByLayer.set(a.layer, entries)
    }
  }
  const candidates = traces.map(() => new Set<number>())
  for (const bounds of boundsByLayer.values()) {
    const index = new Flatbush(bounds.length)
    for (const box of bounds) index.add(box.minX, box.minY, box.maxX, box.maxY)
    index.finish()
    for (const box of bounds) {
      for (const hit of index.search(box.minX, box.minY, box.maxX, box.maxY)) {
        const otherBox = bounds[hit]
        const other = otherBox.traceIndex
        const connected = candidates[box.traceIndex]
        if (
          other > box.traceIndex &&
          !connected.has(other) &&
          map._arePcbTracesConnected(box.segmentTrace, otherBox.segmentTrace)
        ) {
          connected.add(other)
        }
      }
    }
  }
  const connections: string[][] = []
  // Preserve the original pair order for stable net IDs and diagnostics.
  for (const [i, neighbors] of candidates.entries()) {
    for (const j of [...neighbors].sort((a, b) => a - b)) {
      connections.push([traces[i].pcb_trace_id, traces[j].pcb_trace_id])
    }
  }
  const layerConnectivity = createTracePortLayerConnectivity(circuitJson)
  const connectionsByPort = new Map<string, string[][]>()
  for (const trace of traces) {
    for (const point of trace.route) {
      if (point.route_type !== "wire") continue
      for (const portId of new Set([
        point.start_pcb_port_id,
        point.end_pcb_port_id,
      ])) {
        if (!portId || !map.portIdToElm.has(portId)) continue
        if (!layerConnectivity.canConnect(point, portId)) continue
        const entries = connectionsByPort.get(portId) ?? []
        entries.push(
          point.start_pcb_port_id === portId
            ? [portId, trace.pcb_trace_id]
            : [trace.pcb_trace_id, portId],
        )
        connectionsByPort.set(portId, entries)
      }
    }
  }
  for (const portId of map.portIdToElm.keys()) {
    for (const connection of connectionsByPort.get(portId) ?? [])
      connections.push(connection)
  }
  connections.push(...getViaAndPourConnections(circuitJson))
  connections.push(...getTouchingSmtPadConnections(circuitJson))
  map.connMap = new ConnectivityMap(findConnectedNetworks(connections))
  return map
}
