import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping"
import overlappingPort1 from "./keyboards2-multilayer-ijump.solution.json"

describe("checkEachPcbTraceNonOverlapping", () => {
  test("should return no errors for overlapping-port1.json", async () => {
    const soup: AnyCircuitElement[] = overlappingPort1 as any

    const errors = checkEachPcbTraceNonOverlapping(soup)
    expect(errors).toHaveLength(0)
  })
})
