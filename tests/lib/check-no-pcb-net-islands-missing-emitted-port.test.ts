import { expect, test } from "bun:test"
import { checkNoPcbNetIslands } from "lib/check-no-pcb-net-islands"
import { twoPortPcbNet } from "../fixtures/two-port-pcb-net"

test("a net with only one emitted PCB port produces no island error", () => {
  const circuitWithoutSecondPcbPort = twoPortPcbNet.filter((element) => {
    if (element.type === "pcb_port" || element.type === "pcb_smtpad") {
      return element.pcb_port_id !== "pcb_port_B"
    }
    return true
  })

  expect(checkNoPcbNetIslands(circuitWithoutSecondPcbPort)).toEqual([])
})
