import type { AnyCircuitElement, PcbTrace, PcbTraceError } from "circuit-json"
import { getReadableNameForElement } from "@tscircuit/circuit-json-util"
import { segmentToSegmentMinDistance } from "@tscircuit/math-utils"
import {
  DEFAULT_TRACE_MARGIN,
  DEFAULT_TRACE_THICKNESS,
  EPSILON,
} from "lib/drc-defaults"

interface TraceSegment {
  pcb_trace_id: string
  layer: string
  thickness: number
  x1: number
  y1: number
  x2: number
  y2: number
}

export function checkTraceSpacing(
  circuitJson: AnyCircuitElement[],
  { minSpacing = DEFAULT_TRACE_MARGIN }: { minSpacing?: number } = {},
): PcbTraceError[] {
  const traces = circuitJson.filter(
    (el) => el.type === "pcb_trace",
  ) as PcbTrace[]
  const segments: TraceSegment[] = []

  for (const trace of traces) {
    for (let i = 0; i < trace.route.length - 1; i++) {
      const a = trace.route[i]
      const b = trace.route[i + 1]
      if (a.route_type !== "wire" || b.route_type !== "wire") continue
      if (a.layer !== b.layer) continue
      const thickness =
        "width" in a
          ? (a as any).width
          : "width" in b
            ? (b as any).width
            : DEFAULT_TRACE_THICKNESS
      segments.push({
        pcb_trace_id: trace.pcb_trace_id,
        layer: a.layer,
        thickness,
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
      })
    }
  }

  const errors: PcbTraceError[] = []

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const segA = segments[i]
      const segB = segments[j]
      if (segA.pcb_trace_id === segB.pcb_trace_id) continue
      if (segA.layer !== segB.layer) continue
      const distance = segmentToSegmentMinDistance(
        { x: segA.x1, y: segA.y1 },
        { x: segA.x2, y: segA.y2 },
        { x: segB.x1, y: segB.y1 },
        { x: segB.x2, y: segB.y2 },
      )
      const gap = distance - segA.thickness / 2 - segB.thickness / 2
      if (gap + EPSILON >= minSpacing) continue
      errors.push({
        type: "pcb_trace_error",
        error_type: "pcb_trace_error",
        message: `PCB trace ${getReadableNameForElement(
          circuitJson,
          segA.pcb_trace_id,
        )} is too close to ${getReadableNameForElement(
          circuitJson,
          segB.pcb_trace_id,
        )} (gap: ${gap.toFixed(3)}mm)`,
        pcb_trace_id: segA.pcb_trace_id,
        pcb_trace_error_id: `trace_spacing_${segA.pcb_trace_id}_${segB.pcb_trace_id}`,
        source_trace_id: "",
        pcb_component_ids: [],
        pcb_port_ids: [],
      })
    }
  }

  return errors
}
