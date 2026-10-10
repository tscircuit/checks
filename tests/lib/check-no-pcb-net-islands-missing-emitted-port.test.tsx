import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { checkNoPcbNetIslands } from "lib/check-no-pcb-net-islands"
import { DisconnectedPcbNet } from "../fixtures/disconnected-pcb-net"

test("a net with only one emitted PCB port produces no island error", async () => {
  const circuit = new Circuit()
  circuit.add(<DisconnectedPcbNet />)
  await circuit.renderUntilSettled()
  const circuitWithOnePcbPort = circuit.getCircuitJson().filter((element) => {
    if (element.type === "pcb_trace") return false
    if (element.type === "pcb_port" || element.type === "pcb_smtpad") {
      return element.pcb_port_id === "pcb_port_0"
    }
    return true
  })

  expect(checkNoPcbNetIslands(circuitWithOnePcbPort)).toEqual([])
})
