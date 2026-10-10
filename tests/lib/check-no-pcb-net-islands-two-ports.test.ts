import { expect, test } from "bun:test"
import { checkNoPcbNetIslands } from "lib/check-no-pcb-net-islands"
import { twoPortPcbNet } from "../fixtures/two-port-pcb-net"

test("two required PCB ports on separate pads produce one island error", () => {
  expect(checkNoPcbNetIslands(twoPortPcbNet)).toEqual([
    expect.objectContaining({
      pcb_port_ids: ["pcb_port_A", "pcb_port_B"],
      message: "Net [VDD] has disconnected PCB copper: A.VDD | B.VDD.",
    }),
  ])
})
