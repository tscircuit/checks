import { readFileSync } from "node:fs"
import type { AnyCircuitElement, SourceTrace } from "circuit-json"

export const loadPublishedGameboyCircuit = (): AnyCircuitElement[] =>
  JSON.parse(readFileSync(new URL("./circuit.json", import.meta.url), "utf8"))

/** Source-only constraints captured by rendering the unedited published TSX
 * through SourceDesignRuleChecks with the corrected core. PCB data is copied
 * verbatim; every source port/net identity was checked against the publication. */
export const loadCorrectedGameboyCircuit = (): AnyCircuitElement[] => {
  const constraints: Record<
    SourceTrace["source_trace_id"],
    Pick<
      SourceTrace,
      "max_length" | "max_length_origin" | "capacitor_connection"
    >
  > = JSON.parse(
    readFileSync(new URL("./trace-constraints.json", import.meta.url), "utf8"),
  )
  return loadPublishedGameboyCircuit().map((element) => {
    if (element.type !== "source_trace") return element
    const { max_length, max_length_origin, capacitor_connection, ...trace } =
      element
    return { ...trace, ...constraints[element.source_trace_id] }
  })
}

export const gameboyReviewCandidates = [
  "C_VREG_AVDD_P",
  "C_CORE_G",
  "PSRAM_DECOUPLING",
  "PSRAM_BULK",
  "PSRAM_VSS_GND_BRIDGE",
  "BAT_INPUT_CAP_B",
] as const
