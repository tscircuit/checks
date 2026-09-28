import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { pcb_placement_error } from "circuit-json"
import { checkCopperPourShorts } from "lib/check-copper-pour-shorts"

test("a zero-width pad produces a fatal copper-conversion diagnostic", async () => {
  const circuit = new Circuit({ platform: { drcChecksDisabled: true } })
  circuit.add(
    <board width={10} height={10}>
      <net name="GND" />
      <chip
        name="U1"
        pinLabels={{ pin1: "A" }}
        footprint={
          <footprint>
            <smtpad
              shape="rect"
              width={0}
              height={1}
              portHints={["pin1"]}
              pcbX={0}
              pcbY={0}
            />
          </footprint>
        }
      />
      <copperpour layer="bottom" connectsTo="net.GND" />
    </board>,
  )
  await circuit.renderUntilSettled()

  const errors = checkCopperPourShorts(circuit.getCircuitJson())
  expect(errors).toHaveLength(1)
  expect(pcb_placement_error.parse(errors[0])).toMatchObject({
    type: "pcb_placement_error",
    is_fatal: true,
    message: expect.stringContaining("width must be finite and positive"),
  })
})
