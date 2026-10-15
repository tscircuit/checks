import { readFileSync, writeFileSync } from "node:fs"
import { isDeepStrictEqual } from "node:util"
import type { AnyCircuitElement } from "circuit-json"
import * as checks from "../index"
const original: AnyCircuitElement[] = JSON.parse(
  readFileSync(
    process.argv[2] ??
      new URL(
        "../tests/fixtures/gameboy-advance-0.0.15/circuit.json",
        import.meta.url,
      ),
    "utf8",
  ),
)
const constraints = JSON.parse(
  readFileSync(
    new URL(
      "../tests/fixtures/gameboy-advance-0.0.15/trace-constraints.json",
      import.meta.url,
    ),
    "utf8",
  ),
)
const corrected: AnyCircuitElement[] = original.map((e) => {
  if (e.type !== "source_trace") return e
  const { max_length, max_length_origin, capacitor_connection, ...trace } = e
  return { ...trace, ...constraints[e.source_trace_id] }
})
if (
  !isDeepStrictEqual(
    original.filter((e) => e.type.startsWith("pcb_")),
    corrected.filter((e) => e.type.startsWith("pcb_")),
  )
)
  throw Error("PCB geometry changed")
const names = [
  "checkEachPcbPortConnectedToPcbTraces",
  "checkSourceTracesHavePcbTraces",
  "checkEachPcbTraceNonOverlapping",
  "checkTracesAreContiguous",
  "checkSourceTracesMatchPcbTraceThickness",
  "checkPadPadClearance",
  "checkPadTraceClearance",
  "checkViaPadClearance",
  "checkViaTraceClearance",
  "checkSameNetViaSpacing",
  "checkDifferentNetViaSpacing",
  "checkPcbTracesOutOfBoard",
  "checkCopperToBoardEdgeClearance",
  "checkViasOffBoard",
  "checkCopperPourShorts",
  "checkHoleTraceClearance",
  "checkPcbComponentOverCutout",
] as const
const results = []
for (const name of names) {
  const [before, after] = await Promise.all([
    checks[name](structuredClone(original)),
    checks[name](structuredClone(corrected)),
  ])
  const unchanged = isDeepStrictEqual(before, after)
  results.push({ name, before: before.length, after: after.length, unchanged })
  console.log(name, before.length, after.length, unchanged)
  if (!unchanged) throw Error(`Physical check changed: ${name}`)
}
writeFileSync(
  "reports/gameboy-physical-checks.json",
  JSON.stringify({ pcbUnchanged: true, checks: results }, null, 2) + "\n",
)
