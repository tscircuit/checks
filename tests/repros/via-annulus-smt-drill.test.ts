import { expect, test } from "bun:test"
import { lcdEscape } from "./via-annulus-smt-fixture"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"

test("copper entirely inside the drill misses the annulus", () => {
  const circuit = lcdEscape()
  for (const el of circuit) {
    if (el.type === "pcb_smtpad" && el.shape === "rect") {
      el.width = el.height = 0.01
      el.x = 0.946
      el.y = -0.067
    }
    if (el.type === "pcb_port") {
      el.x = 0.946
      el.y = -0.067
    }
  }
  expect(checkTracesAreContiguous(circuit).map((e) => e.pcb_port_ids)).toEqual([
    ["port"],
  ])
})
