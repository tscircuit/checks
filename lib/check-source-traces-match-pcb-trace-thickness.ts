import { getTraceEndpointNeckdownLengths } from "lib/util/get-trace-endpoint-neckdown-lengths"
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
  {
    maxPadNeckdownLength,
  }: {
    /** Maximum routed escape length beyond an endpoint pad, in mm. Defaults
     * to the requested trace width. This is a nominal-width warning heuristic,
     * not an electrical current-capacity or thermal exemption. */
    maxPadNeckdownLength?: number
  } = {},
): PcbTraceWarning[] {
  if (
    maxPadNeckdownLength !== undefined &&
    (!Number.isFinite(maxPadNeckdownLength) || maxPadNeckdownLength < 0)
  ) {
    throw new Error("maxPadNeckdownLength must be finite and nonnegative")
  }
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

    let undersizedSegment:
      | {
          pcb_trace_id: string
          center: { x: number; y: number }
          width: number
        }
      | undefined

    for (const relatedPcbTrace of relatedPcbTraces) {
      const neckdowns = getTraceEndpointNeckdownLengths(
        relatedPcbTrace,
        circuitJson,
        maxPadNeckdownLength ?? requestedThickness,
      )
      for (let i = 0; i < relatedPcbTrace.route.length - 1; i++) {
        const point = relatedPcbTrace.route[i]
        const nextPoint = relatedPcbTrace.route[i + 1]
        if (point.route_type !== "wire" || nextPoint.route_type !== "wire") {
          continue
        }
        if (point.layer !== nextPoint.layer) continue
        if (point.x === nextPoint.x && point.y === nextPoint.y) continue

        // Constant-width copper uses the starting point's width. The final
        // route point does not define another segment. Interpolated copper
        // varies linearly between the two endpoint widths.
        const interpolated =
          relatedPcbTrace.route_thickness_mode === "interpolated"
        if (
          Math.min(point.width, interpolated ? nextPoint.width : point.width) >=
          requestedThickness
        )
          continue

        // Place the marker inside the deficient portion of a taper, rather
        // than at a midpoint that may already be wide enough.
        let startFraction = 0
        let endFraction = 1
        if (interpolated && point.width !== nextPoint.width) {
          const crossing =
            (requestedThickness - point.width) / (nextPoint.width - point.width)
          if (point.width >= requestedThickness) startFraction = crossing
          if (nextPoint.width >= requestedThickness) endFraction = crossing
        }
        const length = Math.hypot(nextPoint.x - point.x, nextPoint.y - point.y)
        startFraction = Math.max(
          startFraction,
          (neckdowns.fromStart.get(i) ?? 0) / length,
        )
        endFraction = Math.min(
          endFraction,
          1 - (neckdowns.fromEnd.get(i) ?? 0) / length,
        )
        if (endFraction - startFraction < 1e-9) continue
        const width = interpolated
          ? Math.min(
              point.width + (nextPoint.width - point.width) * startFraction,
              point.width + (nextPoint.width - point.width) * endFraction,
            )
          : point.width
        if (undersizedSegment && width >= undersizedSegment.width) continue
        const fraction = (startFraction + endFraction) / 2
        undersizedSegment = {
          pcb_trace_id: relatedPcbTrace.pcb_trace_id,
          center: {
            x: point.x + (nextPoint.x - point.x) * fraction,
            y: point.y + (nextPoint.y - point.y) * fraction,
          },
          width,
        }
      }
    }

    if (!undersizedSegment) continue

    warnings.push({
      type: "pcb_trace_warning",
      pcb_trace_warning_id: `pcb_trace_warning_${sourceTrace.source_trace_id}`,
      warning_type: "pcb_trace_warning",
      message: `Trace [${getReadableNameForSourceTrace(circuitJson, sourceTrace)}] is routed thinner than requested (requested: ${requestedThickness}mm, actual: ${undersizedSegment.width}mm).`,
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
