import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { analyzePcbTraceLengths } from "../index"
import {
  gameboyReviewCandidates,
  loadCorrectedGameboyCircuit,
  loadPublishedGameboyCircuit,
} from "../tests/fixtures/gameboy-advance-0.0.15/load"
const published = loadPublishedGameboyCircuit()
const old = published.filter((e) => e.type === "pcb_trace_too_long_error")
const oldTraceIds = new Set(old.map((e) => e.source_trace_id))
const corrected = loadCorrectedGameboyCircuit()
const findings = analyzePcbTraceLengths(corrected).filter((f) =>
  oldTraceIds.has(f.sourceTrace.source_trace_id),
)
const reviewEvidence = JSON.parse(
  readFileSync(
    new URL(
      "../tests/fixtures/gameboy-advance-0.0.15/review-evidence.json",
      import.meta.url,
    ),
    "utf8",
  ),
)
const report = {
  package: "abse/gameboy-advance@0.0.15",
  tscircuit: "0.0.2827",
  limitNote:
    "The 5.5mm project limit is configured. It is not independently verified datasheet guidance and does not alone establish a fabrication defect.",
  reviewCandidates: gameboyReviewCandidates.map((name) => {
    const finding = findings.find((f) => f.sourceTrace.name === name)
    if (!finding) throw new Error(`Missing retained review candidate: ${name}`)
    return { ...finding, reviewEvidence: reviewEvidence[name] }
  }),
  originalFindings: old.map((error) => {
    const trace = corrected.find(
      (e) =>
        e.type === "source_trace" &&
        e.source_trace_id === error.source_trace_id,
    )!
    const finding = findings.find(
      (f) => f.sourceTrace.source_trace_id === error.source_trace_id,
    )
    return {
      name: trace.type === "source_trace" ? trace.name : undefined,
      legacyBranchTotal: error.actual_trace_length,
      outcome:
        finding ??
        "Removed capacitor-derived rule: no identified local IC decoupling connection",
    }
  }),
}
mkdirSync("reports", { recursive: true })
writeFileSync(
  "reports/gameboy-capacitor-lengths.json",
  JSON.stringify(report, null, 2) + "\n",
)
console.log(
  report.reviewCandidates.map((f) => ({
    name: f?.sourceTrace.name,
    origin: f?.sourceTrace.max_length_origin,
    measurement: f?.measurement,
  })),
)
