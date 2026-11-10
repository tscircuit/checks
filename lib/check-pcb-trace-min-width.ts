import { cju } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement, PcbTrace, PcbTraceError } from "circuit-json"
import { getBoardDrcValue, getPcbBoard } from "./drc-defaults"
import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"

export interface PcbTraceMinWidthCheckConfig {
  minTraceWidth?: number
}

/**
 * Checks all PCB traces to ensure their routed wire segments meet or exceed
 * the board's minimum trace width (min_trace_width DRC limit).
 */
export function checkPcbTraceMinWidth(
  circuitJson: AnyCircuitElement[],
  config: PcbTraceMinWidthCheckConfig = {},
): PcbTraceError[] {
  const errors: PcbTraceError[] = []
  const board = getPcbBoard(circuitJson)
  const minTraceWidth =
    config.minTraceWidth ??
    getBoardDrcValue(board, "min_trace_width") ??
    jlcMinTolerances.min_trace_width

  if (!minTraceWidth || minTraceWidth <= 0) return errors

  const db = cju(circuitJson)
  const pcbTraces = db.pcb_trace.list() as PcbTrace[]

  for (const trace of pcbTraces) {
    if (!trace.route || trace.route.length < 2) continue

    for (let i = 0; i < trace.route.length - 1; i++) {
      const p1 = trace.route[i]
      const p2 = trace.route[i + 1]

      if (p1.route_type !== "wire" || p2.route_type !== "wire") continue
      if (p1.layer !== p2.layer) continue
      if (p1.x === p2.x && p1.y === p2.y) continue

      const interpolated = trace.route_thickness_mode === "interpolated"
      const segmentWidth = interpolated
        ? Math.min(p1.width, p2.width)
        : p1.width

      if (segmentWidth < minTraceWidth - 1e-6) {
        errors.push({
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          pcb_trace_error_id: `trace_width_below_min_${trace.pcb_trace_id}_segment_${i}`,
          message: `Trace width ${segmentWidth}mm is below the board minimum (${minTraceWidth}mm)`,
          center: {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2,
          },
          pcb_trace_id: trace.pcb_trace_id,
          source_trace_id: trace.source_trace_id || "",
          pcb_component_ids: [],
          pcb_port_ids: [],
        })
      }
    }
  }

  return errors
}
