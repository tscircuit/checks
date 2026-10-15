import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { runAllRoutingChecks } from "lib/run-all-checks"
import { DisconnectedPcbNet } from "../fixtures/disconnected-pcb-net"

test("aggregate routing detects disconnected copper within one named net", async () => {
  const circuit = new Circuit()
  circuit.add(<DisconnectedPcbNet />)
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const errors = await runAllRoutingChecks(circuitJson)

  expect(errors).toEqual([
    expect.objectContaining({
      error_type: "pcb_port_not_connected_error",
      pcb_port_ids: ["pcb_port_0", "pcb_port_1", "pcb_port_2", "pcb_port_3"],
      message:
        "Net [GND] has disconnected PCB copper: A.pin1, B.pin1 | C.pin1, D.pin1.",
    }),
  ])
})
