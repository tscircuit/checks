import { expect, test, describe } from "bun:test"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping"
import type { AnySoupElement } from "@tscircuit/soup"
import overlappingPort1 from "./keyboards2-multilayer-ijump.solution.json"
import { logSoup } from "@tscircuit/log-soup"

describe("checkEachPcbTraceNonOverlapping", () => {
  test("should return no errors for overlapping-port1.json", async () => {
    const soup: AnySoupElement[] = overlappingPort1 as any

    await logSoup("checks: overlapping-port1", soup)

    const errors = checkEachPcbTraceNonOverlapping(soup)
    console.log(errors)
    expect(errors).toHaveLength(0)
  })
})
