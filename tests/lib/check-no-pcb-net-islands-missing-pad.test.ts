import { expect, test } from "bun:test"
import { checkNoPcbNetIslands } from "lib/check-no-pcb-net-islands"
import { twoPortPcbNet } from "../fixtures/two-port-pcb-net"

test("a net with an emitted PCB port missing its pad is deferred", () => {
  const circuitWithoutSecondPad = twoPortPcbNet.filter(
    (element) =>
      element.type !== "pcb_smtpad" || element.pcb_port_id !== "pcb_port_B",
  )

  expect(checkNoPcbNetIslands(circuitWithoutSecondPad)).toEqual([])
})
