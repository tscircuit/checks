import type {
  AnyCircuitElement,
  PcbTrace,
  PcbTraceRoutePoint,
  PcbTraceTooLongWarning,
  SourceTrace,
} from "circuit-json"

const DEFAULT_VIA_LENGTH_MM = 1.6

const getRoutePointPosition = (routePoint: PcbTraceRoutePoint) =>
  routePoint.route_type === "through_pad"
    ? routePoint.start
    : { x: routePoint.x, y: routePoint.y }

const getPcbTraceLength = (pcbTrace: PcbTrace): number => {
  if (pcbTrace.trace_length !== undefined) return pcbTrace.trace_length

  let traceLength = 0

  for (
    let routePointIndex = 0;
    routePointIndex < pcbTrace.route.length;
    routePointIndex++
  ) {
    const routePoint = pcbTrace.route[routePointIndex]
    if (!routePoint) continue

    if (routePoint.route_type === "via") {
      traceLength += DEFAULT_VIA_LENGTH_MM
      continue
    }

    const nextRoutePoint = pcbTrace.route[routePointIndex + 1]
    if (!nextRoutePoint) continue

    const routePointPosition = getRoutePointPosition(routePoint)
    const nextRoutePointPosition = getRoutePointPosition(nextRoutePoint)
    traceLength += Math.hypot(
      nextRoutePointPosition.x - routePointPosition.x,
      nextRoutePointPosition.y - routePointPosition.y,
    )
  }

  return traceLength
}

export const checkPcbTraceLengths = (
  circuitJson: AnyCircuitElement[],
): PcbTraceTooLongWarning[] => {
  const sourceTraces = circuitJson.filter(
    (element): element is SourceTrace => element.type === "source_trace",
  )
  const pcbTraces = circuitJson.filter(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )

  const sourceTracesById = new Map(
    sourceTraces.map((sourceTrace) => [
      sourceTrace.source_trace_id,
      sourceTrace,
    ]),
  )
  const warnings: PcbTraceTooLongWarning[] = []

  for (const pcbTrace of pcbTraces) {
    if (!pcbTrace.source_trace_id) continue

    const sourceTrace = sourceTracesById.get(pcbTrace.source_trace_id)
    if (!sourceTrace) continue

    const maximumTraceLength = sourceTrace.max_length
    if (typeof maximumTraceLength !== "number") continue

    const actualTraceLength = getPcbTraceLength(pcbTrace)
    if (actualTraceLength <= maximumTraceLength) continue

    warnings.push({
      type: "pcb_trace_too_long_warning",
      pcb_trace_too_long_warning_id: `pcb_trace_too_long_warning_${pcbTrace.pcb_trace_id}`,
      warning_type: "pcb_trace_too_long_warning",
      message: `PCB trace is ${actualTraceLength.toFixed(2)}mm long, exceeding the ${maximumTraceLength}mm maximum`,
      pcb_trace_id: pcbTrace.pcb_trace_id,
      source_trace_id: sourceTrace.source_trace_id,
      source_net_id: sourceTrace.connected_source_net_ids[0],
      actual_trace_length: actualTraceLength,
      maximum_trace_length: maximumTraceLength,
      subcircuit_id: pcbTrace.subcircuit_id ?? sourceTrace.subcircuit_id,
    })
  }

  return warnings
}
