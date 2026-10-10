import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { checkNoPcbNetIslands } from "lib/check-no-pcb-net-islands"
import { DisconnectedPcbNet } from "../fixtures/disconnected-pcb-net"

test("three copper islands produce one error for their net", async () => {
  const circuit = new Circuit()
  circuit.add(<DisconnectedPcbNet />)
  await circuit.renderUntilSettled()
  const circuitWithThreeCopperIslands = circuit
    .getCircuitJson()
    .filter(
      (element) =>
        element.type !== "pcb_trace" || element.pcb_trace_id !== "pcb_trace_1",
    )

  expect(checkNoPcbNetIslands(circuitWithThreeCopperIslands)).toEqual([
    expect.objectContaining({
      pcb_port_ids: ["pcb_port_0", "pcb_port_1", "pcb_port_2", "pcb_port_3"],
      message:
        "Net [GND] has disconnected PCB copper: A.pin1, B.pin1 | C.pin1 | D.pin1.",
    }),
  ])
})
