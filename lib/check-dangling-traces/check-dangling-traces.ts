import type { AnyCircuitElement, PcbTraceError } from "circuit-json"
import { isAntennaTrace } from "../util/is-antenna-trace"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { getReadableNameForPcbTrace } from "@tscircuit/circuit-json-util"
import {
  createEndpointContactTester,
  type TraceEndpoint,
} from "./endpoint-contact"

const ENDPOINT_CONTACT_EPSILON = 1e-9

/** Reports exposed trace endpoints, independently of required-port connectivity. */
export function checkDanglingTraces(
  circuitJson: AnyCircuitElement[],
  { connMap }: { connMap?: ConnectivityMap } = {},
): PcbTraceError[] {
  const errors: PcbTraceError[] = []
  const pcbTraces = circuitJson.filter(
    (element) => element.type === "pcb_trace",
  )
  const sourceTraces = circuitJson.filter(
    (element) => element.type === "source_trace",
  )
  const pcbPorts = circuitJson.filter((element) => element.type === "pcb_port")
  const getEndpointContact = createEndpointContactTester(circuitJson, connMap)

  for (const trace of pcbTraces) {
    // Inferred antenna copper has intentional open ends; feed traces remain checked.
    if (isAntennaTrace(trace, circuitJson)) continue
    if (trace.route.length === 0) continue
    const firstPoint = trace.route[0]
    const lastPoint = trace.route[trace.route.length - 1]
    const sourceTrace = sourceTraces.find(
      (source) => source.source_trace_id === trace.source_trace_id,
    )
    const hasExpectedPorts = pcbPorts.some((port) =>
      sourceTrace?.connected_source_port_ids.includes(port.source_port_id),
    )
    const endpoints = [
      { side: "start", point: firstPoint },
      { side: "end", point: lastPoint },
    ] satisfies { side: TraceEndpoint; point: typeof firstPoint }[]
    const endpointsCoincide =
      firstPoint.route_type === "wire" &&
      lastPoint.route_type === "wire" &&
      firstPoint.layer === lastPoint.layer &&
      Math.hypot(firstPoint.x - lastPoint.x, firstPoint.y - lastPoint.y) <=
        ENDPOINT_CONTACT_EPSILON
    let startErrorReported = false

    for (const { side, point } of endpoints) {
      if (point.route_type !== "wire") continue
      const contact = getEndpointContact(trace, side)
      if (contact.isConnected) continue
      // Port-connected via-only fragments have no lateral wire end to inspect.
      if (hasExpectedPorts && !contact.hasWireSegment) continue
      if (side === "end" && endpointsCoincide && startErrorReported) continue

      const traceName = getReadableNameForPcbTrace(
        circuitJson,
        trace.pcb_trace_id,
      )
      errors.push({
        type: "pcb_trace_error",
        error_type: "pcb_trace_error",
        pcb_trace_error_id: `disconnected_endpoint_${trace.pcb_trace_id}_${side}`,
        message: `Trace [${traceName}] has dangling endpoint at (${point.x.toFixed(2)}, ${point.y.toFixed(2)})`,
        source_trace_id: trace.source_trace_id || `!${trace.pcb_trace_id}`,
        pcb_trace_id: trace.pcb_trace_id,
        center: { x: point.x, y: point.y },
        pcb_component_ids: [],
        pcb_port_ids: [],
      })
      if (side === "start") startErrorReported = true
    }
  }
  return errors
}
