import {
  createPcbTracePathMeasurer,
  type PcbTracePathMeasurement,
} from "./util/measure-pcb-trace-path"
import {
  getReadableNameForElementId,
  getReadableNameForSourcePort,
} from "./util/get-readable-names"
import type {
  AnyCircuitElement,
  PcbPort,
  PcbTrace,
  PcbTraceTooLongError,
  SourceTrace,
} from "circuit-json"

const getReferencedPcbPortIds = (pcbTrace: PcbTrace): Set<string> => {
  const pcbPortIds = new Set<string>()

  for (const routePoint of pcbTrace.route) {
    if (routePoint.route_type !== "wire") continue
    if (routePoint.start_pcb_port_id) {
      pcbPortIds.add(routePoint.start_pcb_port_id)
    }
    if (routePoint.end_pcb_port_id) {
      pcbPortIds.add(routePoint.end_pcb_port_id)
    }
  }

  return pcbPortIds
}

export const getPcbTracesBySourceTraceId = (
  circuitJson: AnyCircuitElement[],
) => {
  const sourceTraces = circuitJson.filter(
    (element): element is SourceTrace => element.type === "source_trace",
  )
  const pcbTraces = circuitJson.filter(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )
  const pcbPorts = circuitJson.filter(
    (element): element is PcbPort => element.type === "pcb_port",
  )

  const pcbPortIdsBySourcePortId = new Map<string, Set<string>>()
  for (const pcbPort of pcbPorts) {
    if (!pcbPort.source_port_id) continue
    const pcbPortIds =
      pcbPortIdsBySourcePortId.get(pcbPort.source_port_id) ?? new Set<string>()
    pcbPortIds.add(pcbPort.pcb_port_id)
    pcbPortIdsBySourcePortId.set(pcbPort.source_port_id, pcbPortIds)
  }

  const pcbTracesBySourceTraceId = new Map<string, PcbTrace[]>()
  for (const pcbTrace of pcbTraces) {
    if (!pcbTrace.source_trace_id) continue
    const matchingPcbTraces =
      pcbTracesBySourceTraceId.get(pcbTrace.source_trace_id) ?? []
    matchingPcbTraces.push(pcbTrace)
    pcbTracesBySourceTraceId.set(pcbTrace.source_trace_id, matchingPcbTraces)
  }

  const exactEndpointPcbTraceIdsBySourceTraceId = new Map<string, Set<string>>()
  for (const sourceTrace of sourceTraces) {
    if (sourceTrace.connected_source_port_ids.length !== 2) continue

    const endpointPcbPortIds = sourceTrace.connected_source_port_ids.map(
      (sourcePortId) => pcbPortIdsBySourcePortId.get(sourcePortId),
    )
    if (endpointPcbPortIds.some((pcbPortIds) => !pcbPortIds?.size)) continue

    const exactEndpointPcbTraceIds = new Set(
      (pcbTracesBySourceTraceId.get(sourceTrace.source_trace_id) ?? [])
        .filter((pcbTrace) => {
          const referencedPcbPortIds = getReferencedPcbPortIds(pcbTrace)
          return endpointPcbPortIds.every((pcbPortIds) =>
            [...pcbPortIds!].some((pcbPortId) =>
              referencedPcbPortIds.has(pcbPortId),
            ),
          )
        })
        .map((pcbTrace) => pcbTrace.pcb_trace_id),
    )

    // Keep the existing behavior when the route does not expose one PCB trace
    // joining both explicit endpoints (for example through-pad-only routes).
    if (exactEndpointPcbTraceIds.size > 0) {
      exactEndpointPcbTraceIdsBySourceTraceId.set(
        sourceTrace.source_trace_id,
        exactEndpointPcbTraceIds,
      )
    }
  }
  for (const [id, exactIds] of exactEndpointPcbTraceIdsBySourceTraceId) {
    pcbTracesBySourceTraceId.set(
      id,
      pcbTracesBySourceTraceId
        .get(id)!
        .filter((trace) => exactIds.has(trace.pcb_trace_id)),
    )
  }
  return pcbTracesBySourceTraceId
}

export interface PcbTraceLengthFinding {
  sourceTrace: SourceTrace
  measurement: PcbTracePathMeasurement
  status: "within_limit" | "exceeds_limit" | "indeterminate"
  message: string
}

/** Inspect all constrained connections, including paths that cannot be measured.
 * A configured limit is a design rule, not independently verified guidance. */
export const analyzePcbTraceLengths = (
  circuitJson: AnyCircuitElement[],
): PcbTraceLengthFinding[] => {
  const measure = createPcbTracePathMeasurer(circuitJson)
  return circuitJson.flatMap((sourceTrace): PcbTraceLengthFinding[] => {
    if (
      sourceTrace.type !== "source_trace" ||
      typeof sourceTrace.max_length !== "number" ||
      !Number.isFinite(sourceTrace.max_length)
    )
      return []
    const connection = sourceTrace.capacitor_connection
    let measurement: PcbTracePathMeasurement
    if (
      sourceTrace.max_length_origin === "inferred_decoupling" &&
      (!connection ||
        connection.capacitor_role !== "decoupling" ||
        !sourceTrace.connected_source_port_ids.includes(
          connection.capacitor_source_port_id,
        ) ||
        !sourceTrace.connected_source_port_ids.includes(
          connection.associated_source_port_id,
        ))
    ) {
      measurement = {
        status: "indeterminate",
        reason:
          "An inferred decoupling rule has no identified local capacitor/IC connection",
      }
    } else measurement = measure(sourceTrace)
    const origin = {
      explicit: "authored trace maxLength",
      inferred_decoupling: "automatic decoupling policy",
      configured_capacitor: "configured capacitor maxDecouplingTraceLength",
      crystal: "crystal layout requirement",
    }[sourceTrace.max_length_origin ?? "explicit"]
    const limitOrigin = sourceTrace.max_length_origin
      ? origin
      : "legacy max_length; origin unavailable"
    const name = getReadableNameForElementId(
      circuitJson,
      sourceTrace.source_trace_id,
    )
    const port =
      connection &&
      circuitJson.find(
        (e) =>
          e.type === "source_port" &&
          e.source_port_id === connection.associated_source_port_id,
      )
    const capacitorName = connection
      ? getReadableNameForElementId(
          circuitJson,
          connection.capacitor_source_component_id,
        )
      : undefined
    const capacitorPorts = circuitJson.filter(
      (e) =>
        e.type === "source_port" &&
        sourceTrace.connected_source_port_ids.includes(e.source_port_id),
    )
    const attachedCapacitors = circuitJson
      .filter(
        (e) => e.type === "source_component" && e.ftype === "simple_capacitor",
      )
      .filter((e) =>
        capacitorPorts.some(
          (p) =>
            p.type === "source_port" &&
            p.source_component_id === e.source_component_id,
        ),
      )
    const context = connection
      ? `${capacitorName} (${connection.capacitor_role} capacitor, ${connection.connection_type} to ${port?.type === "source_port" ? getReadableNameForSourcePort(circuitJson, port) : "unresolved IC pin"})`
      : attachedCapacitors.length
        ? `${attachedCapacitors.map((c) => getReadableNameForElementId(circuitJson, c.source_component_id)).join(", ")} (capacitor role unspecified); no local decoupling IC/pin identified`
        : "no capacitor decoupling association"
    const explanation = `${name}: ${context}; limit ${sourceTrace.max_length}mm from ${limitOrigin}`
    if (measurement.status === "indeterminate") {
      const exceedsFromKnownCopper =
        measurement.knownPathLengthLowerBound !== undefined &&
        measurement.knownPathLengthLowerBound > sourceTrace.max_length + 1e-9
      return [
        {
          sourceTrace,
          measurement,
          status: exceedsFromKnownCopper ? "exceeds_limit" : "indeterminate",
          message: `${explanation}; total path indeterminate: ${measurement.reason}${measurement.knownPathLengthLowerBound !== undefined ? `; routed copper lower bound ${measurement.knownPathLengthLowerBound.toFixed(2)}mm with unresolved barrel/pad depth` : ""}${exceedsFromKnownCopper ? "; known copper alone exceeds the configured rule" : ""}. Layout review required.`,
        },
      ]
    }
    const exceeds = measurement.length > sourceTrace.max_length + 1e-9
    return [
      {
        sourceTrace,
        measurement,
        status: exceeds ? "exceeds_limit" : "within_limit",
        message: `${explanation}; ${measurement.method === "shortest_copper_path" ? (sourceTrace.max_length_origin === "explicit" ? "authored routed copper path including pad traversal and known barrel depth" : "shortest routed copper path including pad traversal and known barrel depth") : "single authored route"} measures ${measurement.length.toFixed(2)}mm${exceeds ? ", exceeding the configured rule. Layout review required." : ", within the configured rule."}`,
      },
    ]
  })
}

export const checkPcbTraceLengths = (
  circuitJson: AnyCircuitElement[],
): PcbTraceTooLongError[] => {
  const diagnostics: PcbTraceTooLongError[] = []
  for (const finding of analyzePcbTraceLengths(circuitJson)) {
    const { sourceTrace, measurement } = finding
    // Unresolved totals remain available in the analysis/report. A measured
    // path or its known minimum must demonstrate a violation to emit an error.
    if (finding.status !== "exceeds_limit") continue
    const pathTraceIds = measurement.pcbTraceIds ?? []
    const measuredLength =
      measurement.status === "measured"
        ? measurement.length
        : measurement.knownPathLengthLowerBound
    if (measuredLength === undefined) continue
    const pcbTrace = circuitJson.find(
      (e) => e.type === "pcb_trace" && pathTraceIds.includes(e.pcb_trace_id),
    )
    if (pcbTrace?.type !== "pcb_trace") continue
    const common = {
      source_trace_id: sourceTrace.source_trace_id,
      maximum_trace_length: sourceTrace.max_length!,
      max_length_origin: sourceTrace.max_length_origin,
      capacitor_connection: sourceTrace.capacitor_connection,
      subcircuit_id: pcbTrace.subcircuit_id ?? sourceTrace.subcircuit_id,
      message: finding.message,
    }
    diagnostics.push({
      ...common,
      pcb_trace_id: pcbTrace.pcb_trace_id,
      type: "pcb_trace_too_long_error",
      pcb_trace_too_long_error_id: `pcb_trace_too_long_error_${sourceTrace.source_trace_id}`,
      error_type: "pcb_trace_too_long_error",
      source_net_id: sourceTrace.connected_source_net_ids[0],
      actual_trace_length: measuredLength,
      actual_trace_length_is_lower_bound:
        measurement.status === "indeterminate" ? true : undefined,
      measurement_method:
        measurement.status === "measured"
          ? measurement.method
          : "copper_path_lower_bound",
      path_pcb_trace_ids: measurement.pcbTraceIds,
      path_pcb_via_ids: measurement.pcbViaIds,
    })
  }
  return diagnostics
}
