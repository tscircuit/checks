import type {
  AnyCircuitElement,
  PcbTrace,
  PcbTraceRoutePoint,
  PcbTraceTooLongWarning,
  SourcePort,
  SourceTrace,
} from "circuit-json"

const DEFAULT_CRYSTAL_MAX_TRACE_LENGTH_MM = 10
const DEFAULT_VIA_LENGTH_MM = 1.6

type SubcircuitConnectivityMapKey = NonNullable<
  SourceTrace["subcircuit_connectivity_map_key"]
>

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
  const crystalSourceComponentIds = new Set(
    circuitJson
      .filter(
        (element) =>
          element.type === "source_component" &&
          element.ftype === "simple_crystal",
      )
      .map((sourceComponent) => sourceComponent.source_component_id),
  )
  const sourcePorts = circuitJson.filter(
    (element): element is SourcePort => element.type === "source_port",
  )
  const sourceTraces = circuitJson.filter(
    (element): element is SourceTrace => element.type === "source_trace",
  )
  const pcbTraces = circuitJson.filter(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )

  const sourcePortsById = new Map(
    sourcePorts.map((sourcePort) => [sourcePort.source_port_id, sourcePort]),
  )
  const sourceTracesById = new Map(
    sourceTraces.map((sourceTrace) => [
      sourceTrace.source_trace_id,
      sourceTrace,
    ]),
  )
  const crystalMaxLengthsBySubcircuitConnectivityMapKey = new Map<
    SubcircuitConnectivityMapKey,
    number
  >()
  const crystalMaxLengthsBySourceTraceId = new Map<string, number>()

  for (const sourceTrace of sourceTraces) {
    const isConnectedToCrystal = sourceTrace.connected_source_port_ids.some(
      (sourcePortId) => {
        const sourcePort = sourcePortsById.get(sourcePortId)
        if (!sourcePort?.source_component_id) return false

        return crystalSourceComponentIds.has(sourcePort.source_component_id)
      },
    )
    if (!isConnectedToCrystal) continue

    const crystalMaxLength =
      sourceTrace.max_length ?? DEFAULT_CRYSTAL_MAX_TRACE_LENGTH_MM
    crystalMaxLengthsBySourceTraceId.set(
      sourceTrace.source_trace_id,
      crystalMaxLength,
    )

    const subcircuitConnectivityMapKey =
      sourceTrace.subcircuit_connectivity_map_key
    if (!subcircuitConnectivityMapKey) continue

    const existingCrystalMaxLength =
      crystalMaxLengthsBySubcircuitConnectivityMapKey.get(
        subcircuitConnectivityMapKey,
      )

    crystalMaxLengthsBySubcircuitConnectivityMapKey.set(
      subcircuitConnectivityMapKey,
      existingCrystalMaxLength === undefined
        ? crystalMaxLength
        : Math.min(existingCrystalMaxLength, crystalMaxLength),
    )
  }

  const warnings: PcbTraceTooLongWarning[] = []

  for (const pcbTrace of pcbTraces) {
    if (!pcbTrace.source_trace_id) continue

    const sourceTrace = sourceTracesById.get(pcbTrace.source_trace_id)
    if (!sourceTrace) continue

    const propagatedCrystalMaxLength =
      sourceTrace.subcircuit_connectivity_map_key
        ? crystalMaxLengthsBySubcircuitConnectivityMapKey.get(
            sourceTrace.subcircuit_connectivity_map_key,
          )
        : undefined
    const maximumTraceLengths = [
      sourceTrace.max_length,
      crystalMaxLengthsBySourceTraceId.get(sourceTrace.source_trace_id),
      propagatedCrystalMaxLength,
    ].filter((length): length is number => typeof length === "number")
    if (maximumTraceLengths.length === 0) continue

    const maximumTraceLength = Math.min(...maximumTraceLengths)
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
