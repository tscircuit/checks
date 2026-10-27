import { expect, test } from "bun:test"
import { Utils } from "@flatten-js/core"
import { getPlatedHolePolygon } from "@tscircuit/circuit-json-util"
import { Circuit } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkEachPcbPortConnectedToPcbTraces } from "../../lib/check-each-pcb-port-connected-to-pcb-trace"

// Native source only: the nearly circular slot, rotation and world placement
// leave a positive-length edge below Flatten's zero tolerance after scaling.
const circuit = new Circuit({ platform: { routingDrcChecksDisabled: true } })
circuit.add(
  <board width={10} height={50} routingDisabled>
    <net name="SIGNAL" />
    <chip
      name="J1"
      pcbX={0}
      pcbY={20}
      pinLabels={{ pin1: ["CONTACT"] }}
      connections={{ pin1: "net.SIGNAL" }}
      footprint={
        <footprint>
          <platedhole
            portHints={["pin1"]}
            shape="pill"
            pcbRotation={90}
            outerWidth={3}
            outerHeight={2}
            holeWidth={1.0000000000010001}
            holeHeight={1}
          />
        </footprint>
      }
    />
    <testpoint
      name="TP1"
      pcbX={2}
      pcbY={20}
      layer="bottom"
      footprintVariant="pad"
      padDiameter={0.1}
      connections={{ pin1: "net.SIGNAL" }}
    />
    <testpoint
      name="TP2"
      pcbX={0}
      pcbY={22}
      layer="bottom"
      footprintVariant="pad"
      padDiameter={0.1}
      connections={{ pin1: "net.SIGNAL" }}
    />
    <trace
      from=".TP1 > .pin1"
      to=".TP2 > .pin1"
      thickness={0.1}
      pcbPath={[{ x: -2, y: 0 }]}
    />
  </board>,
)
await circuit.renderUntilSettled()
const circuitJson = circuit.getCircuitJson()

test("native slotted-pad input and visual context", async () => {
  expect(circuitJson.filter((e) => e.type.endsWith("_error"))).toEqual([])
  const hole = circuitJson.find((e) => e.type === "pcb_plated_hole")!
  const polygon = getPlatedHolePolygon(hole).scale(1e6, 1e6)
  expect(
    [...polygon.edges].some((e) => e.length > 0 && Utils.EQ_0(e.length)),
  ).toBe(true)
  for (const [name, viewport] of [
    ["near-zero-slot-overview", { minX: -2, maxX: 3, minY: 17.8, maxY: 23.2 }],
    [
      "near-zero-slot-detail",
      { minX: -0.7, maxX: 0.9, minY: 19.3, maxY: 20.7 },
    ],
  ] as const) {
    await expect(
      convertCircuitJsonToPcbSvg(circuitJson, {
        width: 900,
        height: 800,
        layer: "bottom",
        viewport,
        xRayElementIds: circuitJson
          .filter((e) => e.type === "pcb_trace")
          .map((e) => e.pcb_trace_id),
        backgroundColor: "white",
        includeVersion: false,
      }),
    ).toMatchSvgSnapshot(import.meta.path, name)
  }
})

test("connectivity handles a native near-zero slot edge without altering input", () => {
  const before = structuredClone(circuitJson)
  expect(checkEachPcbPortConnectedToPcbTraces(circuitJson)).toEqual([])
  expect(circuitJson).toEqual(before)
})
