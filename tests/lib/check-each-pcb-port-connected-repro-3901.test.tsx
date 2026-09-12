import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkEachPcbPortConnectedToPcbTraces } from "lib/check-each-pcb-port-connected-to-pcb-trace"
import { containsCircuitJsonId } from "lib/util/get-readable-names"

const J1_FOOTPRINT = (
  <footprint>
    <platedhole
      portHints={["1"]}
      shape="circle"
      pcbX={0}
      pcbY={0}
      outerDiameter="1mm"
      holeDiameter="0.5mm"
    />
  </footprint>
)

const J2_FOOTPRINT = (
  <footprint>
    <platedhole
      portHints={["2"]}
      shape="circle"
      pcbX={0}
      pcbY={0}
      outerDiameter="1mm"
      holeDiameter="0.5mm"
    />
  </footprint>
)

test("repro for #3901: two plated GND ports on bottom pour and no pcb traces", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width="12mm" height="8mm" routingDisabled>
      <net name="GND" isGroundNet />

      <connector
        name="J1"
        pcbX={-2}
        pcbY={0}
        layer="bottom"
        footprint={J1_FOOTPRINT}
        pinLabels={{ 1: ["1"] }}
        connections={{ 1: "net.GND" }}
      />

      <connector
        name="J2"
        pcbX={2}
        pcbY={0}
        layer="bottom"
        footprint={J2_FOOTPRINT}
        pinLabels={{ 2: ["2"] }}
        connections={{ 2: "net.GND" }}
      />

      <trace from=".J1 > .1" to=".J2 > .2" />
      <copperpour layer="bottom" connectsTo="net.GND" />
    </board>,
  )

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const errors = checkEachPcbPortConnectedToPcbTraces(circuitJson)

  expect(errors).toHaveLength(3)
  expect(errors).toMatchObject([
    {
      type: "pcb_port_not_connected_error",
      error_type: "pcb_port_not_connected_error",
      message: "Port [J1.1] is not connected to net [GND] by a PCB trace.",
    },
    {
      type: "pcb_port_not_connected_error",
      error_type: "pcb_port_not_connected_error",
      message: "Port [J2.2] is not connected to net [GND] by a PCB trace.",
    },
    {
      type: "pcb_port_not_connected_error",
      error_type: "pcb_port_not_connected_error",
      message: "Ports [J1.1, J2.2] are not connected together through the same net.",
    },
  ])

  expect(
    errors.map(
      ({
        pcb_port_not_connected_error_id: _id,
        pcb_port_ids,
        pcb_component_ids,
        ...error
      }) => error,
    ),
  ).toMatchInlineSnapshot(`
    [
      {
        "error_type": "pcb_port_not_connected_error",
        "message": "Port [J1.1] is not connected to net [GND] by a PCB trace.",
        "type": "pcb_port_not_connected_error",
      },
      {
        "error_type": "pcb_port_not_connected_error",
        "message": "Port [J2.2] is not connected to net [GND] by a PCB trace.",
        "type": "pcb_port_not_connected_error",
      },
      {
        "error_type": "pcb_port_not_connected_error",
        "message": "Ports [J1.1, J2.2] are not connected together through the same net.",
        "type": "pcb_port_not_connected_error",
      },
    ]
  `)

  expect(containsCircuitJsonId(errors[0]!.message)).toBe(false)

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path, "repro-3901")
})
