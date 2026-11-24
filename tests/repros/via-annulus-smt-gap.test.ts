import { expect, test } from "bun:test"
import { lcdEscape, checkEscape } from "./via-annulus-smt-fixture"

test("a 0.01 mm air gap or a buried via leaves the top pad open", () => {
  for (const circuit of [
    lcdEscape(0.935),
    lcdEscape(0.906, ["inner2", "bottom"]),
  ]) {
    expect(checkEscape(circuit).map((error) => error.type)).toEqual([
      "pcb_port_not_connected_error",
      "pcb_trace_error",
    ])
  }
})
