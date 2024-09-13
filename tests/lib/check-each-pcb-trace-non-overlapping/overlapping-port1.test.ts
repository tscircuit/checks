import { expect, test, describe } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping"
import type { AnySoupElement } from "@tscircuit/soup"
import overlappingPort1 from "./keyboards2-multilayer-ijump.solution.json"

describe("checkEachPcbTraceNonOverlapping", () => {
  test("should return no errors for overlapping-port1.json", async () => {
    const soup: AnySoupElement[] = overlappingPort1 as any

    const errors = checkEachPcbTraceNonOverlapping(soup)
    expect(errors).toHaveLength(0)
  })
})
