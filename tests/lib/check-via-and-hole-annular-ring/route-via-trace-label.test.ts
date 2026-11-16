import { expect, test } from "bun:test"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"
import { conciseTrace } from "./fixtures"

test("a route via names its trace, and says so when the trace is unnamed", () => {
  const namedCircuitJson = conciseTrace("trace_1", {
    type: "source_trace",
    source_trace_id: "source_trace_1",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    display_name: "VBUS",
  })

  const namedErrors = checkViaAndHoleAnnularRing(namedCircuitJson)
  expect(namedErrors).toHaveLength(1)
  const namedMessage = namedErrors[0]!.message
  expect(
    namedMessage.startsWith("via on trace VBUS at (1.00mm, 1.00mm): "),
  ).toBe(true)
  expect(namedMessage).not.toContain("trace_1")

  const unnamedErrors = checkViaAndHoleAnnularRing(conciseTrace("trace_1"))
  expect(unnamedErrors).toHaveLength(1)
  const unnamedMessage = unnamedErrors[0]!.message
  expect(
    unnamedMessage.startsWith("via on unnamed trace at (1.00mm, 1.00mm): "),
  ).toBe(true)
  expect(unnamedMessage).not.toContain("trace_1")
})
