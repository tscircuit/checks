import type { AnyCircuitElement } from "circuit-json"

type DrcRecord = AnyCircuitElement & Record<string, unknown>

/**
 * Removes generic pcb_trace_error records when a more specific pad-trace or
 * via-trace clearance error describes the same physical pair.
 *
 * The specific record is retained because it includes the measured and
 * required clearance. Trace-trace and all other generic errors are untouched.
 *
 * @deprecated Aggregate runners now classify trace-obstacle pairs as either
 * overlap or clearance before combining results, so they no longer need this
 * post-processing step. Kept for callers combining results from older checks.
 */
export const dedupePcbDrcErrors = <T extends AnyCircuitElement>(
  errors: T[],
): T[] => {
  const specificallyReportedPairIds = new Set<string>()

  for (const error of errors as DrcRecord[]) {
    if (
      error.type === "pcb_pad_trace_clearance_error" &&
      typeof error.pcb_trace_id === "string" &&
      typeof error.pcb_pad_id === "string"
    ) {
      specificallyReportedPairIds.add(
        `overlap_${error.pcb_trace_id}_${error.pcb_pad_id}`,
      )
    }

    if (
      error.type === "pcb_via_trace_clearance_error" &&
      typeof error.pcb_trace_id === "string" &&
      typeof error.pcb_via_id === "string"
    ) {
      specificallyReportedPairIds.add(
        `overlap_${error.pcb_trace_id}_${error.pcb_via_id}`,
      )
    }
  }

  return errors.filter((element) => {
    const error = element as DrcRecord
    return !(
      error.type === "pcb_trace_error" &&
      typeof error.pcb_trace_error_id === "string" &&
      specificallyReportedPairIds.has(error.pcb_trace_error_id)
    )
  })
}
