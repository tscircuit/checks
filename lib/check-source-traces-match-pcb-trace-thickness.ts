import { cju } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  PcbPort,
  PcbTrace,
  PcbTraceWarning,
  SourceTrace,
} from "circuit-json"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { getReadableNameForSourceTrace } from "lib/util/get-readable-names"

export function checkSourceTracesMatchPcbTraceThickness(
  circuitJson: AnyCircuitElement[],
): PcbTraceWarning[] {
  const warnings: PcbTraceWarning[] = []
  const db = cju(circuitJson)

  const sourceTraces = db.source_trace.list() as SourceTrace[]
  const pcbTraces = db.pcb_trace.list() as PcbTrace[]
  const pcbPorts = db.pcb_port.list() as PcbPort[]
  const connectivityMap = getFullConnectivityMapFromCircuitJson(circuitJson)

  for (const sourceTrace of sourceTraces) {
    const requestedThickness = sourceTrace.min_trace_thickness
    if (requestedThickness === undefined) continue

    const connectedPcbPorts = pcbPorts.filter((pcbPort) =>
      sourceTrace.connected_source_port_ids?.includes(pcbPort.source_port_id),
    )
    if (connectedPcbPorts.length < 2) continue

    const referenceNetId = connectivityMap.getNetConnectedToId(
      connectedPcbPorts[0].pcb_port_id,
    )
    if (!referenceNetId) continue

    const netElementIds = connectivityMap.getIdsConnectedToNet(referenceNetId)
    const relatedPcbTraces = pcbTraces.filter((pcbTrace) =>
      netElementIds.includes(pcbTrace.pcb_trace_id),
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

    let undersizedSegment:
      | { pcb_trace_id: string; center: { x: number; y: number } }
      | undefined

    for (const relatedPcbTrace of relatedPcbTraces) {
      for (let i = 0; i < relatedPcbTrace.route.length - 1; i++) {
        const point = relatedPcbTrace.route[i]
        const nextPoint = relatedPcbTrace.route[i + 1]
        if (!point || !nextPoint) continue
        if (point.route_type !== "wire" || nextPoint.route_type !== "wire") {
          continue
        }
        if (point.width !== actualThickness) continue

        undersizedSegment = {
          pcb_trace_id: relatedPcbTrace.pcb_trace_id,
          center: {
            x: (point.x + nextPoint.x) / 2,
            y: (point.y + nextPoint.y) / 2,
          },
        }
        break
      }

      if (undersizedSegment) break
    }

    if (!undersizedSegment) continue

    warnings.push({
      type: "pcb_trace_warning",
      pcb_trace_warning_id: `pcb_trace_warning_${sourceTrace.source_trace_id}`,
      warning_type: "pcb_trace_warning",
      message: `Trace [${getReadableNameForSourceTrace(circuitJson, sourceTrace)}] is routed thinner than requested (requested: ${requestedThickness}mm, actual: ${actualThickness}mm).`,
      center: undersizedSegment.center,
      source_trace_id: sourceTrace.source_trace_id,
      pcb_trace_id: undersizedSegment.pcb_trace_id,
      pcb_component_ids: Array.from(
        new Set(
          connectedPcbPorts
            .map((pcbPort) => pcbPort.pcb_component_id)
            .filter((id): id is string => id !== undefined),
        ),
      ),
      pcb_port_ids: connectedPcbPorts.map((pcbPort) => pcbPort.pcb_port_id),
    })
  }

  return warnings
}
