import { expect, test } from "bun:test"
import { checkNoPcbNetIslands } from "lib/check-no-pcb-net-islands"
import { disconnectedPcbNet } from "../fixtures/disconnected-pcb-net"

test("three copper islands produce one error for their net", () => {
  const circuitWithThreeCopperIslands = disconnectedPcbNet.filter(
    (element) =>
      element.type !== "pcb_trace" || element.pcb_trace_id !== "pcb_trace_2",
  )

  expect(checkNoPcbNetIslands(circuitWithThreeCopperIslands)).toEqual([
    expect.objectContaining({
      pcb_port_ids: ["pcb_port_0", "pcb_port_1", "pcb_port_2", "pcb_port_3"],
      message:
        "Net [V3V3] has disconnected PCB copper: A.VDD, B.VDD | C.VDD | D.VDD.",
    }),
  ])
})
