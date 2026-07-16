import { describe, expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkViaTraceClearance } from "lib/check-via-trace-clearance"
import circuitJson from "../../assets/via-too-close-to-trace.json"

describe("PCB vias in non-overlapping trace checks", () => {
  test("reports a positive via-trace gap as clearance, not overlap", async () => {
    const overlapErrors = checkEachPcbTraceNonOverlapping(circuitJson as any)
    const clearanceErrors = checkViaTraceClearance(circuitJson as any)

    expect(overlapErrors).toEqual([])
    expect(clearanceErrors).toHaveLength(1)
    expect(clearanceErrors[0]!.actual_clearance).toBeGreaterThan(0)

    const svg = convertCircuitJsonToPcbSvg(circuitJson as any)
    await expect(svg).toMatchSvgSnapshot(import.meta.path)
  })
})
