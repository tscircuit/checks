import { analyzePcbStyle } from "@tscircuit/circuit-json-pcb-style-analysis/analysis"
import type { AnyCircuitElement, PcbTraceStyleWarning } from "circuit-json"
import { getReadableNameForTrace } from "./util/get-readable-names"

/** Analyze PCB trace style as part of the standard routing checks. */
export function checkPcbTraceStyle(
  circuitJson: AnyCircuitElement[],
): PcbTraceStyleWarning[] {
  return analyzePcbStyle(circuitJson).issues.map((issue) => ({
    type: "pcb_trace_style_warning",
    pcb_trace_style_warning_id: `pcb_trace_style_warning_${issue.pcbTraceId}_${issue.startRouteIndex}_${issue.endRouteIndex}`,
    warning_type: "pcb_trace_style_warning",
    styling_issue_type: "long_segment_at_odd_angle",
    pcb_trace_id: issue.pcbTraceId,
    source_trace_id: issue.sourceTraceId,
    subcircuit_id: issue.subcircuitId,
    layer: issue.layer as PcbTraceStyleWarning["layer"],
    start_route_index: issue.startRouteIndex,
    end_route_index: issue.endRouteIndex,
    segment_start: issue.start,
    segment_end: issue.end,
    center: issue.location,
    segment_length: issue.lengthMm,
    minimum_segment_length: issue.maxSegmentLengthMm,
    angle_degrees: issue.angleDegrees,
    nearest_allowed_angle_degrees: issue.nearestAllowedAngleDegrees,
    angle_deviation_degrees: issue.deviationDegrees,
    angle_tolerance_degrees: issue.angleToleranceDegrees,
    // Analyzer messages include IDs; format readable circuit names instead.
    message: `${getReadableNameForTrace(circuitJson, issue.pcbTraceId)} has a ${issue.lengthMm.toFixed(2)} mm segment on ${issue.layer} at ${issue.angleDegrees.toFixed(2)}°, ${issue.deviationDegrees.toFixed(2)}° from the nearest allowed direction (${issue.nearestAllowedAngleDegrees}°). Prefer a multiple of 45° for segments longer than ${issue.maxSegmentLengthMm} mm (tolerance ${issue.angleToleranceDegrees}°).`,
  }))
}
