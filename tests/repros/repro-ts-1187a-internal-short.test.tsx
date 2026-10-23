import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Fragment } from "react"
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
      {[
        { pcbY: 4, signal: "ESP_EN" },
        { pcbY: -4, signal: "ESP_GPIO0" },
      ].map(({ pcbY, signal }) => (
        <Fragment key={signal}>
          <pcbnotetext
            text="A: SIGNAL"
            pcbX={-6}
            pcbY={pcbY + 1.85}
            fontSize="0.5mm"
            color="#67e8f9"
          />
          <pcbnotetext
            text="B: GND"
            pcbX={5.7}
            pcbY={pcbY + 1.85}
            fontSize="0.5mm"
            color="#67e8f9"
          />
          <pcbnotetext
            text="C: SIGNAL"
            pcbX={-6}
            pcbY={pcbY - 1.85}
            fontSize="0.5mm"
            color="#67e8f9"
          />
          <pcbnotetext
            text="D: GND"
            pcbX={5.7}
            pcbY={pcbY - 1.85}
            fontSize="0.5mm"
            color="#67e8f9"
          />
          {[1.85, -1.85].map((padY) => (
            <Fragment key={padY}>
              <pcbnotepath
                route={[
                  { x: -3, y: pcbY + padY },
                  { x: 3, y: pcbY + padY },
                  { x: 2.6, y: pcbY + padY + 0.2 },
                  { x: 3, y: pcbY + padY },
                  { x: 2.6, y: pcbY + padY - 0.2 },
                ]}
                color="#67e8f9"
                strokeWidth="0.08mm"
              />
            </Fragment>
          ))}
          <pcbnotetext
            text="A-B: INTERNAL / ALWAYS CONNECTED"
            pcbY={pcbY + 1.1}
            fontSize="0.3mm"
            color="#67e8f9"
          />
          <pcbnotetext
            text={`${signal} -> A -> B -> GND`}
            pcbY={pcbY}
            fontSize="0.36mm"
            color="#ffffff"
          />
          <pcbnotetext
            text="C-D: INTERNAL / ALWAYS CONNECTED"
            pcbY={pcbY - 1.1}
            fontSize="0.3mm"
            color="#67e8f9"
          />
        </Fragment>
      ))}
      <pcbnotetext
        text="CYAN ARROWS: INSIDE SWITCH, NOT PCB COPPER"
        pcbY={-8}
        fontSize="0.35mm"
        color="#67e8f9"
      />
      <pcbnotetext
        text="SHORT EXISTS EVEN WHEN BUTTON IS RELEASED"
        pcbY={-9}
        fontSize="0.35mm"
        color="#ffffff"
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
