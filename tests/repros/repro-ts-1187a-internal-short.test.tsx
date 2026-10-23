import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { checkTwoTerminalSwitchContactsOnDifferentNets } from "../../lib/check-two-terminal-switch-contacts-on-different-nets"

// C318884 / TS-1187A-B-A-B: A-B and C-D are permanently connected.
// The published ESP32-S3 webcam instead connects A/C to signal and B/D to GND.
async function renderButton(shorted: boolean) {
  const circuit = new Circuit()
  circuit.add(
    <board width="20mm" height="20mm" routingDisabled>
      <pushbutton
        name="SW_RESET"
        manufacturerPartNumber="TS-1187A-B-A-B"
        supplierPartNumbers={{ jlcpcb: ["C318884"] }}
        pinLabels={{ pin1: ["A"], pin2: ["B"], pin3: ["C"], pin4: ["D"] }}
        internallyConnectedPins={[
          ["A", "B"],
          ["C", "D"],
        ]}
        footprint="smdpushbutton4_px6mm_py3.7mm_pw1mm_ph0.75mm"
        connections={
          shorted
            ? { A: "net.ESP_EN", C: "net.ESP_EN", B: "net.GND", D: "net.GND" }
            : { A: "net.ESP_EN", B: "net.ESP_EN", C: "net.GND", D: "net.GND" }
        }
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  return circuit.getCircuitJson()
}

test("TS-1187A internal connections expose the webcam reset short", async () => {
  const circuitJson = await renderButton(true)
  expect(
    checkTwoTerminalSwitchContactsOnDifferentNets(circuitJson),
  ).toMatchObject([
    {
      type: "source_component_misconfigured_error",
      is_fatal: true,
      message:
        "Switch SW_RESET has both schematic contacts connected to the same net. Check internallyConnectedPins and the footprint pin mapping.",
    },
  ])
})

test("TS-1187A corrected wiring keeps its two contacts on separate nets", async () => {
  expect(
    checkTwoTerminalSwitchContactsOnDifferentNets(await renderButton(false)),
  ).toEqual([])
})

test("internal switch shorts work with cached keys and separate internal records", async () => {
  const circuitJson = await renderButton(true)
  for (const element of circuitJson) {
    if (
      element.type !== "source_component" ||
      !element.internally_connected_source_port_ids
    )
      continue
    for (const [
      index,
      source_port_ids,
    ] of element.internally_connected_source_port_ids.entries()) {
      circuitJson.push({
        type: "source_component_internal_connection",
        source_component_internal_connection_id: `internal_${index}`,
        source_component_id: element.source_component_id,
        source_port_ids,
      })
    }
    element.internally_connected_source_port_ids = undefined
  }
  expect(
    checkTwoTerminalSwitchContactsOnDifferentNets(
      circuitJson.filter((element) => element.type !== "source_trace"),
    ),
  ).toHaveLength(1)
})

test("internal switch shorts work without cached connectivity keys", async () => {
  const circuitJson = await renderButton(true)
  for (const element of circuitJson) {
    if (element.type === "source_port")
      element.subcircuit_connectivity_map_key = undefined
  }
  expect(
    checkTwoTerminalSwitchContactsOnDifferentNets(circuitJson),
  ).toHaveLength(1)
})

test("unnamed shorted switches use a readable diagnostic", async () => {
  const circuitJson = await renderButton(true)
  for (const element of circuitJson) {
    if (element.type === "source_component") element.name = ""
  }
  const [error] = checkTwoTerminalSwitchContactsOnDifferentNets(circuitJson)
  expect(error?.message).toBe(
    "Switch unnamed component has both schematic contacts connected to the same net. Check internallyConnectedPins and the footprint pin mapping.",
  )
})

test("two schematic contacts mapped to one internal pair still report a short", async () => {
  const circuitJson = await renderButton(false)
  const firstPairIds = circuitJson.flatMap((element) =>
    element.type === "source_port" && ["A", "B"].includes(element.name)
      ? [element.source_port_id]
      : [],
  )
  const twoContactCircuit = circuitJson.filter(
    (element) =>
      element.type !== "schematic_port" ||
      firstPairIds.includes(element.source_port_id),
  )
  expect(
    twoContactCircuit.filter((element) => element.type === "schematic_port"),
  ).toHaveLength(2)
  expect(
    checkTwoTerminalSwitchContactsOnDifferentNets(twoContactCircuit),
  ).toHaveLength(1)
})

test("equal cached keys in separate subcircuits do not short switch terminals", async () => {
  const circuitJson = (await renderButton(false)).filter(
    (element) => element.type !== "source_trace",
  )
  for (const element of circuitJson) {
    if (element.type !== "source_port") continue
    element.subcircuit_connectivity_map_key = "local_net0"
    element.subcircuit_id = ["A", "B"].includes(element.name)
      ? "subcircuit_first"
      : "subcircuit_second"
  }
  expect(checkTwoTerminalSwitchContactsOnDifferentNets(circuitJson)).toEqual([])
})
