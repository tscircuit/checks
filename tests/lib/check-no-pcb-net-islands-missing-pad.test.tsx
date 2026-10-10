import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { checkNoPcbNetIslands } from "lib/check-no-pcb-net-islands"
import { DisconnectedPcbNet } from "../fixtures/disconnected-pcb-net"

test("a net with an emitted PCB port missing its pad is deferred", async () => {
  const circuit = new Circuit()
  circuit.add(<DisconnectedPcbNet />)
  await circuit.renderUntilSettled()
  const circuitWithoutSecondPad = circuit
    .getCircuitJson()
    .filter(
      (element) =>
        element.type !== "pcb_smtpad" || element.pcb_port_id !== "pcb_port_1",
    )

  expect(checkNoPcbNetIslands(circuitWithoutSecondPad)).toEqual([])
})
