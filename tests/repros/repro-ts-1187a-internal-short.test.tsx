import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkTwoTerminalSwitchContactsOnDifferentNets } from "../../lib/check-two-terminal-switch-contacts-on-different-nets"
import { TS_1187A_B_A_B } from "../fixtures/TS_1187A_B_A_B"
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"

test("TS-1187A internal connections short the webcam reset and boot switches", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width="22mm" height="20mm" autorouter="auto-local">
      <TS_1187A_B_A_B
        name="SW_RESET"
        pcbY={4}
        connections={{
          A: "net.ESP_EN",
          C: "net.ESP_EN",
          B: "net.GND",
          D: "net.GND",
        }}
      />
      <TS_1187A_B_A_B
        name="SW_BOOT"
        pcbY={-4}
        connections={{
          A: "net.ESP_GPIO0",
          C: "net.ESP_GPIO0",
          B: "net.GND",
          D: "net.GND",
        }}
      />
    </board>,
  )
  await circuit.renderUntilSettled()

  const circuitJson = normalizeFixtureSourcePorts(circuit.getCircuitJson())
  const errors = checkTwoTerminalSwitchContactsOnDifferentNets(circuitJson)

  expect(
    circuitJson.filter((element) => element.type === "pcb_trace").length,
  ).toBeGreaterThan(0)

  expect(errors.map((error) => error.message)).toMatchInlineSnapshot(`
    [
      "Switch SW_RESET has both schematic contacts connected to the same net. Check internallyConnectedPins and the footprint pin mapping.",
      "Switch SW_BOOT has both schematic contacts connected to the same net. Check internallyConnectedPins and the footprint pin mapping.",
    ]
  `)
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      width: 1400,
      height: 900,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
