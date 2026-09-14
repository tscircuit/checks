import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import type { SourceNet } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkEachPcbPortConnectedToPcbTraces } from "lib/check-each-pcb-port-connected-to-pcb-trace"
import { containsCircuitJsonId } from "lib/util/get-readable-names"

// Use the issue's autorouter callback so routing runs without adding tracks.
const explicitOnly = async () => {
  const handlers: Record<string, (result: { traces: [] }) => void> = {}
  return {
    on: (event: string, callback: (result: { traces: [] }) => void) => {
      handlers[event] = callback
    },
    start: () => handlers.complete({ traces: [] }),
    stop: () => {},
  }
}

test("repro for #3901: two plated GND ports on bottom pour and no pcb traces", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board
      width={10}
      height={10}
      layers={2}
      autorouter={{ algorithmFn: explicitOnly }}
    >
      <net name="GND" />
      <chip
        name="J1"
        pcbX={-2}
        pcbY={0}
        pinLabels={{ pin1: "GND" }}
        footprint={
          <footprint>
            <platedhole
              portHints={["1"]}
              holeDiameter={0.8}
              outerDiameter={1.4}
              shape="circle"
              pcbX={0}
              pcbY={0}
            />
            <courtyardcircle radius={1} pcbX={0} pcbY={0} />
          </footprint>
        }
      />
      <trace from="J1.pin1" to="net.GND" />

      <chip
        name="J2"
        pcbX={2}
        pcbY={0}
        pinLabels={{ pin1: "GND" }}
        footprint={
          <footprint>
            <platedhole
              portHints={["1"]}
              holeDiameter={0.8}
              outerDiameter={1.4}
              shape="circle"
              pcbX={0}
              pcbY={0}
            />
            <courtyardcircle radius={1} pcbX={0} pcbY={0} />
          </footprint>
        }
      />
      <trace from="J2.pin1" to="net.GND" />
      <via
        name="VGND"
        pcbX={0}
        pcbY={0}
        holeDiameter={0.3}
        outerDiameter={0.6}
        connectsTo="net.GND"
      />
      <copperpour
        layer="bottom"
        connectsTo="net.GND"
        clearance={0.16}
        boardEdgeMargin={0.31}
      />
    </board>,
  )

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const groundNet = circuitJson.find(
    (element): element is SourceNet =>
      element.type === "source_net" && element.name === "GND",
  )
  expect(groundNet).toBeDefined()
  expect(
    circuitJson.filter((element) => element.type === "pcb_trace"),
  ).toHaveLength(0)
  expect(
    circuitJson.filter((element) => element.type === "pcb_plated_hole"),
  ).toHaveLength(2)
  const copperPours = circuitJson.filter(
    (element) => element.type === "pcb_copper_pour",
  )
  expect(copperPours).toHaveLength(1)
  expect(copperPours[0]).toMatchObject({
    layer: "bottom",
    source_net_id: groundNet!.source_net_id,
  })

  const errors = checkEachPcbPortConnectedToPcbTraces(circuitJson)

  expect(errors).toHaveLength(2)
  expect(errors).toMatchObject([
    {
      type: "pcb_port_not_connected_error",
      error_type: "pcb_port_not_connected_error",
      message: "Port [J1.GND] is not connected to net [GND] by a PCB trace.",
    },
    {
      type: "pcb_port_not_connected_error",
      error_type: "pcb_port_not_connected_error",
      message: "Port [J2.GND] is not connected to net [GND] by a PCB trace.",
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
        "message": "Port [J1.GND] is not connected to net [GND] by a PCB trace.",
        "type": "pcb_port_not_connected_error",
      },
      {
        "error_type": "pcb_port_not_connected_error",
        "message": "Port [J2.GND] is not connected to net [GND] by a PCB trace.",
        "type": "pcb_port_not_connected_error",
      },
    ]
  `)

  expect(containsCircuitJsonId(errors[0]!.message)).toBe(false)

  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      layer: "bottom",
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path, "repro-3901")
})
