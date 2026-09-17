import { checkCopperPourShorts } from "../lib/check-copper-pour-shorts"
import board from "../tests/fixtures/mspm0g3507-usb-c-dev-board.json"
import type { AnyCircuitElement } from "circuit-json"

// Run with: bun benchmarks/copper-pour-shorts.ts
// No timing assertion: CI hardware/load varies. Always verify the result.
const samples: number[] = []
for (let i = 0; i < 11; i++) {
  const start = performance.now()
  const errors = checkCopperPourShorts(board as AnyCircuitElement[])
  samples.push(performance.now() - start)
  const ids = errors.map((e) => e.pcb_placement_error_id).sort()
  if (
    JSON.stringify(ids) !==
    JSON.stringify([
      "copper_pour_short_pcb_copper_pour_54_pcb_smtpad_10",
      "copper_pour_short_pcb_copper_pour_54_pcb_smtpad_11",
    ])
  )
    throw new Error(`Unexpected shorts: ${JSON.stringify(ids)}`)
}
const firstMs = samples.shift()!
samples.sort((a, b) => a - b)
console.log({
  runtime: `Bun ${Bun.version}`,
  elements: board.length,
  firstMs,
  iterations: samples.length,
  medianMs: (samples[4] + samples[5]) / 2,
  minMs: samples[0],
  maxMs: samples.at(-1),
})
