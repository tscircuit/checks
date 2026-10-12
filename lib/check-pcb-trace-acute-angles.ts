import type { AnyCircuitElement, PcbTrace, PcbTraceError } from "circuit-json"

export interface PcbTraceAcuteAngleCheckConfig {
  /** Minimum angle between consecutive trace segments in degrees. Defaults to 80. */
  minAngleDegrees?: number
}

const DEFAULT_MIN_ANGLE_DEGREES = 80
const EPSILON = 1e-4

/**
 * Checks for acute angles / acid traps between consecutive wire segments of PCB traces.
 * Sharp bends (angles < minAngleDegrees, default 80°) trap etchant during PCB manufacturing
 * causing trace necking or over-etching defects.
 */
export function checkPcbTraceAcuteAngles(
  circuitJson: AnyCircuitElement[],
  config: PcbTraceAcuteAngleCheckConfig = {},
): PcbTraceError[] {
  const errors: PcbTraceError[] = []
  const minAngle = config.minAngleDegrees ?? DEFAULT_MIN_ANGLE_DEGREES

  const traces = circuitJson.filter(
    (el): el is PcbTrace => el.type === "pcb_trace",
  )

  for (const trace of traces) {
    if (!trace.route || trace.route.length < 3) continue

    for (let i = 1; i < trace.route.length - 1; i++) {
      const p1 = trace.route[i - 1]
      const p2 = trace.route[i]
      const p3 = trace.route[i + 1]

      // Only check consecutive wire segments on the same layer
      if (
        p1.route_type !== "wire" ||
        p2.route_type !== "wire" ||
        p3.route_type !== "wire"
      ) {
        continue
      }
      if (p1.layer !== p2.layer || p2.layer !== p3.layer) {
        continue
      }

      const u1x = p1.x - p2.x
      const u1y = p1.y - p2.y
      const u2x = p3.x - p2.x
      const u2y = p3.y - p2.y

      const d1 = Math.hypot(u1x, u1y)
      const d2 = Math.hypot(u2x, u2y)

      if (d1 < EPSILON || d2 < EPSILON) continue

      const dot = u1x * u2x + u1y * u2y
      const cosTheta = Math.max(-1, Math.min(1, dot / (d1 * d2)))
      const angleDegrees = Math.acos(cosTheta) * (180 / Math.PI)

      if (angleDegrees < minAngle - EPSILON) {
        errors.push({
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          pcb_trace_error_id: `trace_acute_angle_${trace.pcb_trace_id}_vertex_${i}`,
          message: `Trace angle of ${angleDegrees.toFixed(1)}° at (${p2.x.toFixed(2)}mm, ${p2.y.toFixed(2)}mm) is below the minimum allowed angle (${minAngle}°) (acid trap defect)`,
          center: { x: p2.x, y: p2.y },
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
