import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import type { AnyCircuitElement, SourceNet } from "circuit-json"
import { checkNoPcbNetIslands } from "lib/check-no-pcb-net-islands"
import { DisconnectedPcbNet } from "../fixtures/disconnected-pcb-net"

test("each disconnected net produces one error", async () => {
  const circuit = new Circuit()
  circuit.add(<DisconnectedPcbNet />)
  await circuit.renderUntilSettled()

  const circuitJson: AnyCircuitElement[] = []
  for (const circuitElement of circuit.getCircuitJson()) {
    if (circuitElement.type === "pcb_trace") continue
    if (
      circuitElement.type === "source_trace" &&
      ["source_trace_2", "source_trace_3"].includes(
        circuitElement.source_trace_id,
      )
    ) {
      circuitJson.push({
        ...circuitElement,
        connected_source_net_ids: ["source_net_1"],
      })
      continue
    }
    circuitJson.push(circuitElement)
  }
  const powerNet: SourceNet = {
    type: "source_net",
    source_net_id: "source_net_1",
    name: "V3V3",
    member_source_group_ids: [],
  }
  circuitJson.push(powerNet)

  const errors = checkNoPcbNetIslands(circuitJson)

  expect(errors).toEqual([
    expect.objectContaining({
      pcb_port_ids: ["pcb_port_0", "pcb_port_1"],
      message: "Net [GND] has disconnected PCB copper: A.pin1 | B.pin1.",
    }),
    expect.objectContaining({
      pcb_port_ids: ["pcb_port_2", "pcb_port_3"],
      message: "Net [V3V3] has disconnected PCB copper: C.pin1 | D.pin1.",
    }),
  ])
})
