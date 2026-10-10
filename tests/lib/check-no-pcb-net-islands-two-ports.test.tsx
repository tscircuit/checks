import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { checkNoPcbNetIslands } from "lib/check-no-pcb-net-islands"
import { DisconnectedPcbNet } from "../fixtures/disconnected-pcb-net"

test("two required PCB ports on separate pads produce one island error", async () => {
  const circuit = new Circuit()
  circuit.add(<DisconnectedPcbNet />)
  await circuit.renderUntilSettled()
  const circuitWithTwoPcbPorts = circuit.getCircuitJson().filter((element) => {
    if (element.type === "pcb_trace") return false
    if (element.type === "pcb_port" || element.type === "pcb_smtpad") {
      return (
        element.pcb_port_id === "pcb_port_0" ||
        element.pcb_port_id === "pcb_port_1"
      )
    }
    return true
  })

  expect(checkNoPcbNetIslands(circuitWithTwoPcbPorts)).toEqual([
    expect.objectContaining({
      pcb_port_ids: ["pcb_port_0", "pcb_port_1"],
      message: "Net [GND] has disconnected PCB copper: A.pin1 | B.pin1.",
    }),
  ])
})
