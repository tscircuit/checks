import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { runAllRoutingChecks } from "lib/run-all-checks"

test("named GND net with two disconnected copper islands", async () => {
  const circuit = new Circuit({ platform: { routingDrcChecksDisabled: true } })
  circuit.add(
    <board width={16} height={9} routeRemaining={false}>
      <net name="GND" />
      <testpoint name="J1" footprintVariant="pad" pcbX={-5} padDiameter={1} />
      <testpoint name="J2" footprintVariant="pad" pcbX={-3} padDiameter={1} />
      <testpoint name="J3" footprintVariant="pad" pcbX={3} padDiameter={1} />
      <testpoint name="J4" footprintVariant="pad" pcbX={5} padDiameter={1} />
      <trace from=".J1 > .pin1" to="net.GND" />
      <trace from=".J2 > .pin1" to="net.GND" />
      <trace from=".J3 > .pin1" to="net.GND" />
      <trace from=".J4 > .pin1" to="net.GND" />
      <trace from=".J1 > .pin1" to=".J2 > .pin1" pcbStraightLine />
      <trace from=".J3 > .pin1" to=".J4 > .pin1" pcbStraightLine />
      <pcbnotetext text="All four pads belong to GND" pcbY={3} fontSize={0.5} />
      <pcbnotetext
        text="Two copper islands; no connecting trace or pour"
        pcbY={-2}
        fontSize={0.4}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  expect(circuitJson.filter((e) => e.type === "pcb_trace")).toHaveLength(2)
  const errors = await runAllRoutingChecks(circuitJson)
  expect(errors).toEqual([
    expect.objectContaining({
      type: "pcb_port_not_connected_error",
      pcb_port_ids: circuitJson
        .filter((e) => e.type === "pcb_port")
        .map((port) => port.pcb_port_id),
      message:
        "Net [GND] has disconnected PCB copper: J1.pin1, J2.pin1 | J3.pin1, J4.pin1.",
    }),
  ])
  circuitJson.push({
    type: "pcb_note_text",
    pcb_note_text_id: "check_result",
    text: `Native routing checks: ${errors.length} findings`,
    anchor_position: { x: 0, y: -3.2 },
    anchor_alignment: "center",
    font_size: 0.5,
    font: "tscircuit2024",
    layer: "top",
  })
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
