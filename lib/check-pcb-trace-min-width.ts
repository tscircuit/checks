import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type {
  AnyCircuitElement,
  PcbPort,
  PcbTrace,
  PcbTraceError,
} from "circuit-json"
import { formatMm } from "format-si-unit"
import { EPSILON, getBoardDrcValue } from "./drc-defaults"
import { getOwningPcbBoardResolver } from "./util/get-owning-pcb-board"
import { getReadableNameForTrace } from "./util/get-readable-names"
import { getTraceEndpointNeckdownLengths } from "./util/get-trace-endpoint-neckdown-lengths"

const formatLocation = ({ x, y }: { x: number; y: number }) =>
  `(${x.toFixed(2)}mm, ${y.toFixed(2)}mm)`

interface NarrowestSegment {
  width: number
  center: { x: number; y: number }
}

/**
 * Narrowest copper of a trace thinner than `requiredWidth`, ignoring the part
 * of a route that lies inside its own endpoint pad (that copper is the pad's).
 * Board-world coordinates in mm.
 */
const findNarrowestSegmentBelowWidth = (
  trace: PcbTrace,
  circuitJson: AnyCircuitElement[],
  requiredWidth: number,
): NarrowestSegment | undefined => {
  const interpolated = trace.route_thickness_mode === "interpolated"
  let inPadLengths:
    | ReturnType<typeof getTraceEndpointNeckdownLengths>
    | undefined
  let narrowest: NarrowestSegment | undefined

  for (let i = 0; i < trace.route.length - 1; i++) {
    const point = trace.route[i]
    const nextPoint = trace.route[i + 1]
    if (point.route_type !== "wire" || nextPoint.route_type !== "wire") continue
    if (point.layer !== nextPoint.layer) continue
    const length = Math.hypot(nextPoint.x - point.x, nextPoint.y - point.y)
    if (length === 0) continue

    // Constant-width copper uses the starting point's width; interpolated
    // copper tapers linearly between the two point widths.
    const startWidth = point.width
    const endWidth = interpolated ? nextPoint.width : point.width
    if (!Number.isFinite(startWidth) || !Number.isFinite(endWidth)) continue
    if (Math.min(startWidth, endWidth) + EPSILON >= requiredWidth) continue

    // Restrict to the part of the taper that is actually too thin
    let startFraction = 0
    let endFraction = 1
    if (startWidth !== endWidth) {
      const crossing = (requiredWidth - startWidth) / (endWidth - startWidth)
      if (startWidth >= requiredWidth) startFraction = crossing
      if (endWidth >= requiredWidth) endFraction = crossing
    }

    // Only computed for traces that are too thin somewhere
    inPadLengths ??= getTraceEndpointNeckdownLengths(trace, circuitJson, 0)
    startFraction = Math.max(
      startFraction,
      (inPadLengths.fromStart.get(i) ?? 0) / length,
    )
    endFraction = Math.min(
      endFraction,
      1 - (inPadLengths.fromEnd.get(i) ?? 0) / length,
    )
    if (endFraction - startFraction < 1e-9) continue

    const width = Math.min(
      startWidth + (endWidth - startWidth) * startFraction,
      startWidth + (endWidth - startWidth) * endFraction,
    )
    if (narrowest && width >= narrowest.width) continue
    const fraction = (startFraction + endFraction) / 2
    narrowest = {
      width,
      center: {
        x: point.x + (nextPoint.x - point.x) * fraction,
        y: point.y + (nextPoint.y - point.y) * fraction,
      },
    }
  }

  return narrowest
}

/**
 * Reports traces narrower than their board's min_trace_width (falling back to
 * the JLCPCB minimum), one error per trace at its narrowest point. Copper
 * inside the trace's own endpoint pad is ignored, but a neckdown that leaves
 * the pad must still meet the minimum because it has to be fabricated.
 */
export function checkPcbTraceMinWidth(
  circuitJson: AnyCircuitElement[],
  { minTraceWidth }: { minTraceWidth?: number } = {},
): PcbTraceError[] {
  const traces = circuitJson.filter(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )
  if (traces.length === 0) return []

  const getOwningBoard = getOwningPcbBoardResolver(circuitJson)
  const pcbPortsById = new Map(
    circuitJson
      .filter((element): element is PcbPort => element.type === "pcb_port")
      .map((pcbPort) => [pcbPort.pcb_port_id, pcbPort]),
  )
  const errors: PcbTraceError[] = []

  for (const trace of traces) {
    const requiredWidth =
      minTraceWidth ??
      getBoardDrcValue(getOwningBoard(trace), "min_trace_width") ??
      jlcMinTolerances.min_trace_width!
    const narrowest = findNarrowestSegmentBelowWidth(
      trace,
      circuitJson,
      requiredWidth,
    )
    if (!narrowest) continue

    const pcbPortIds = [
      ...new Set(
        trace.route.flatMap((point) =>
          point.route_type === "wire"
            ? [point.start_pcb_port_id, point.end_pcb_port_id].filter(
                (id): id is string => Boolean(id),
              )
            : [],
        ),
      ),
    ]
    const name = getReadableNameForTrace(circuitJson, trace.pcb_trace_id)
    const label =
      name === "unnamed trace"
        ? `Unnamed trace at ${formatLocation(narrowest.center)}`
        : `Trace ${name}`

    errors.push({
      type: "pcb_trace_error",
      error_type: "pcb_trace_error",
      pcb_trace_error_id: `pcb_trace_min_width_${trace.pcb_trace_id}`,
      message: `${label} is ${formatMm(narrowest.width)} wide, below the minimum trace width of ${formatMm(requiredWidth)}`,
      center: narrowest.center,
      pcb_trace_id: trace.pcb_trace_id,
      source_trace_id: trace.source_trace_id ?? "",
      pcb_component_ids: [
        ...new Set(
          pcbPortIds
            .map((id) => pcbPortsById.get(id)?.pcb_component_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ],
      pcb_port_ids: pcbPortIds,
      ...(trace.subcircuit_id && { subcircuit_id: trace.subcircuit_id }),
    })
  }

  return errors
}
