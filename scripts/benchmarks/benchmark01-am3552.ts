import { gunzipSync } from "node:zlib"
import { createHash } from "node:crypto"
import type { AnyCircuitElement } from "circuit-json"
import { runAllRoutingChecks } from "../../lib/run-all-checks"

// Keep the same built AM3352 board across revisions; no network or autorouting.
const fixture = await Bun.file(
  new URL("./fixtures/am3352.circuit.json.gz", import.meta.url),
).arrayBuffer()
const original: AnyCircuitElement[] = JSON.parse(gunzipSync(fixture).toString())
const times: number[] = []
let expectedDigest: string | undefined
for (let run = 1; run <= 5; run++) {
  // Endpoint inference mutates routes: each run must start with fresh input.
  const circuitJson = structuredClone(original)
  const start = performance.now()
  const errors = await runAllRoutingChecks(circuitJson)
  const elapsed = performance.now() - start
  times.push(elapsed)
  const digest = createHash("sha256")
    .update(JSON.stringify(errors))
    .digest("hex")
  if (expectedDigest && digest !== expectedDigest) {
    throw new Error("DRC results changed between benchmark runs")
  }
  expectedDigest = digest
  console.log(`Run ${run}: ${elapsed.toFixed(2)} ms (${errors.length} errors)`)
}
console.log(
  `Average of 5 runs: ${(times.reduce((a, b) => a + b, 0) / 5).toFixed(2)} ms`,
)
console.log(`Result SHA-256: ${expectedDigest}`)
