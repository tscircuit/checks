import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Fragment } from "react"
import { checkTwoTerminalSwitchContactsOnDifferentNets } from "../../lib/check-two-terminal-switch-contacts-on-different-nets"
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"
import { TS_1187A_B_A_B } from "../fixtures/ts-1187a-b-a-b"

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
            text="A-B: DECLARED INTERNAL CONNECTION"
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
            text="C-D: DECLARED INTERNAL CONNECTION"
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
        text="DECLARED INTERNAL CONNECTIONS JOIN SIGNAL AND GND"
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
      "SW_RESET: SW_RESET.A (ESP_EN) and SW_RESET.B (GND) are declared internally connected, joining ESP_EN to GND. Check the pin connections and footprint mapping.",
      "SW_BOOT: SW_BOOT.A (ESP_GPIO0) and SW_BOOT.B (GND) are declared internally connected, joining ESP_GPIO0 to GND. Check the pin connections and footprint mapping.",
    ]
  `)
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      width: 1400,
      height: 900,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)

  const separateRecords = structuredClone(circuitJson)
  for (const element of separateRecords) {
    if (element.type !== "source_component") continue
    const internalGroups = element.internally_connected_source_port_ids ?? []
    element.internally_connected_source_port_ids = undefined
    for (const [index, source_port_ids] of internalGroups.entries()) {
      separateRecords.push({
        type: "source_component_internal_connection",
        source_component_internal_connection_id: `${element.source_component_id}_internal_${index}`,
        source_component_id: element.source_component_id,
        source_port_ids,
      })
    }
  }
  expect(
    checkTwoTerminalSwitchContactsOnDifferentNets(separateRecords).map(
      (error) => error.message,
    ),
  ).toEqual(errors.map((error) => error.message))

  const aliasCircuit = structuredClone(circuitJson)
  const sourceNetIds = aliasCircuit.flatMap((element) => {
    if (element.type !== "source_net") return []
    return [element.source_net_id]
  })
  aliasCircuit.push({
    type: "source_trace",
    source_trace_id: "source_trace_net_aliases",
    connected_source_port_ids: [],
    connected_source_net_ids: sourceNetIds,
  })
  expect(
    checkTwoTerminalSwitchContactsOnDifferentNets(aliasCircuit).map(
      (error) => error.message,
    ),
  ).toEqual([
    "SW_RESET: contacts SW_RESET.A and SW_RESET.C are electrically connected. Check the wiring and internal pin mapping; the two switch contacts must be on separate nets.",
    "SW_BOOT: contacts SW_BOOT.A and SW_BOOT.C are electrically connected. Check the wiring and internal pin mapping; the two switch contacts must be on separate nets.",
  ])

  const unnamedCircuit = structuredClone(circuitJson)
  for (const element of unnamedCircuit) {
    if (element.type === "source_component" || element.type === "source_net")
      element.name = ""
    if (element.type === "source_port") element.name = ""
  }
  const unnamedErrors =
    checkTwoTerminalSwitchContactsOnDifferentNets(unnamedCircuit)
  expect(unnamedErrors).toHaveLength(2)
  for (const error of unnamedErrors) {
    expect(error.message).toContain("unnamed net")
    expect(error.message).not.toMatch(/source_(?:port|component|net)_/)
  }
})
