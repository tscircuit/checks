import type {
  AnyCircuitElement,
  PcbPort,
  PcbTrace,
  PcbTraceError,
  SourceTrace,
} from "circuit-json"
import { containsCircuitJsonId } from "lib/util/get-readable-names"

const getSourceTraceIdsFromPcbTrace = (
  pcbTraceSourceTraceId?: string,
): string[] => {
  if (!pcbTraceSourceTraceId) return []
  if (!pcbTraceSourceTraceId.includes("__")) return [pcbTraceSourceTraceId]

  return pcbTraceSourceTraceId
    .split("__")
    .filter((part) => part.startsWith("source_trace_"))
}

export function checkSourceTracesMatchPcbTraceThickness(
  circuitJson: AnyCircuitElement[],
): PcbTraceError[] {
  const errors: PcbTraceError[] = []
  const sourceTraces = circuitJson.filter(
    (el) => el.type === "source_trace",
  ) as SourceTrace[]
  const pcbTraces = circuitJson.filter(
    (el) => el.type === "pcb_trace",
  ) as PcbTrace[]
  const pcbPorts = circuitJson.filter(
    (el) => el.type === "pcb_port",
  ) as PcbPort[]

  for (const sourceTrace of sourceTraces) {
    const requestedThickness = sourceTrace.min_trace_thickness
    if (requestedThickness === undefined) continue

    const relatedPcbTraces = pcbTraces.filter((pcbTrace) =>
      getSourceTraceIdsFromPcbTrace(pcbTrace.source_trace_id).includes(
        sourceTrace.source_trace_id,
      ),
    )
    if (relatedPcbTraces.length === 0) continue

    const actualWireWidths = relatedPcbTraces.flatMap((pcbTrace) =>
      pcbTrace.route
        .filter((point) => point.route_type === "wire")
        .map((point) => point.width),
    )
    if (actualWireWidths.length === 0) continue

    const actualThickness = Math.min(...actualWireWidths)
    if (actualThickness >= requestedThickness) continue

    const connectedPcbPorts = pcbPorts.filter((pcbPort) =>
      sourceTrace.connected_source_port_ids?.includes(pcbPort.source_port_id),
    )

    const traceLabel =
      sourceTrace.display_name &&
      !containsCircuitJsonId(sourceTrace.display_name)
        ? sourceTrace.display_name
        : "trace"

    errors.push({
      type: "pcb_trace_error",
      error_type: "pcb_trace_error",
      pcb_trace_error_id: `trace_thickness_${sourceTrace.source_trace_id}`,
      message: `Trace [${traceLabel}] is routed thinner than requested (requested: ${requestedThickness}mm, actual: ${actualThickness}mm).`,
      source_trace_id: sourceTrace.source_trace_id,
      pcb_trace_id: relatedPcbTraces[0].pcb_trace_id,
      pcb_component_ids: Array.from(
        new Set(
          connectedPcbPorts
            .map((pcbPort) => pcbPort.pcb_component_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ),
      pcb_port_ids: connectedPcbPorts.map((pcbPort) => pcbPort.pcb_port_id),
    })
  }

  return errors
}
