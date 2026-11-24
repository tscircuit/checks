import { expect, test } from "bun:test"
import { checkEachPcbPortConnectedToPcbTraces } from "../../lib/check-each-pcb-port-connected-to-pcb-trace"
import { lcdEscape } from "./via-annulus-smt-fixture"

test("contact with only a foreign-net escape leaves LCD_DE open", () => {
  const circuit = lcdEscape()
  circuit.push(
    {
      type: "source_net",
      source_net_id: "other",
      name: "OTHER",
      member_source_group_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "foreign_trace",
      connected_source_port_ids: [],
      connected_source_net_ids: ["other"],
    },
  )
  for (const el of circuit)
    if (el.type === "pcb_trace") el.source_trace_id = "foreign_trace"
  expect(
    checkEachPcbPortConnectedToPcbTraces(circuit).map((e) => e.pcb_port_ids),
  ).toEqual([["port"]])
})
