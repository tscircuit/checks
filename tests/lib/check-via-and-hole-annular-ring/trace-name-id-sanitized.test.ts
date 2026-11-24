import { expect, test } from "bun:test"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"
import { conciseTrace } from "./fixtures"

test("a trace name that repeats an element id is sanitized away", () => {
  // `source_trace.display_name` is one source of a routed trace's name (the
  // helper also derives names from connected ports); a name equal to the
  // trace's own id must not reach the message.
  const circuitJson = conciseTrace("pcb_trace_9", {
    type: "source_trace",
    source_trace_id: "source_trace_1",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    display_name: "pcb_trace_9",
  })

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors).toHaveLength(1)
  const message = errors[0]!.message
  expect(message.startsWith("via on unnamed trace at (1.00mm, 1.00mm): ")).toBe(
    true,
  )
  expect(message).not.toContain("pcb_trace_9")
})
