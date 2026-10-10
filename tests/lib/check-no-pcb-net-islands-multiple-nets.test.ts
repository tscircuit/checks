import { expect, test } from "bun:test"
import type { AnyCircuitElement, SourceNet } from "circuit-json"
import { checkNoPcbNetIslands } from "lib/check-no-pcb-net-islands"
import { disconnectedPcbNet } from "../fixtures/disconnected-pcb-net"

test("each disconnected net produces one error", () => {
  const circuitJson: AnyCircuitElement[] = []
  for (const circuitElement of disconnectedPcbNet) {
    if (circuitElement.type === "pcb_trace") continue
    if (
      circuitElement.type === "source_trace" &&
      ["source_trace_2", "source_trace_3"].includes(
        circuitElement.source_trace_id,
      )
    ) {
      circuitJson.push({
        ...circuitElement,
        connected_source_net_ids: ["source_net_2"],
      })
      continue
    }
    circuitJson.push(circuitElement)
  }
  const groundNet: SourceNet = {
    type: "source_net",
    source_net_id: "source_net_2",
    name: "GND",
    member_source_group_ids: [],
  }
  circuitJson.push(groundNet)

  const errors = checkNoPcbNetIslands(circuitJson)

  expect(errors).toEqual([
    expect.objectContaining({
      pcb_port_ids: ["pcb_port_0", "pcb_port_1"],
      message: "Net [V3V3] has disconnected PCB copper: A.VDD | B.VDD.",
    }),
    expect.objectContaining({
      pcb_port_ids: ["pcb_port_2", "pcb_port_3"],
      message: "Net [GND] has disconnected PCB copper: C.VDD | D.VDD.",
    }),
  ])
})
