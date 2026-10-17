import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { runAllRoutingChecks } from "../../lib/run-all-checks"

test("repro: routing checks miss a dead-end GND pour finger", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={14} height={16} layers={2} schematicDisabled routingDisabled>
      <net name="GND" />
      <chip
        name="J1"
        pcbY={-4}
        pinLabels={{ pin1: "TX", pin2: "GND", pin3: "RX" }}
        footprint="pinrow3_id0.8_od1.6_p2.54_norefdes"
      />
      <chip
        name="J2"
        pcbY={4}
        pinLabels={{ pin1: "TX", pin2: "GND", pin3: "RX" }}
        footprint="pinrow3_id0.8_od1.6_p2.54_norefdes"
      />
      <trace
        from=".J1 > .TX"
        to=".J2 > .TX"
        thickness={0.25}
        pcbPath={[
          { x: -0.75, y: 1.79 },
          { x: -0.75, y: 6.21 },
        ]}
      />
      <trace
        from=".J1 > .RX"
        to=".J2 > .RX"
        thickness={0.25}
        pcbPath={[
          { x: 0.75, y: 1.79 },
          { x: 0.75, y: 6.21 },
        ]}
      />
      <trace from=".J1 > .GND" to="net.GND" />
      <trace from=".J2 > .GND" to="net.GND" />
      <copperpour
        layer="top"
        connectsTo="net.GND"
        useThermalReliefs={false}
        outline={[
          { x: -1.5, y: -5.5 },
          { x: 1.5, y: -5.5 },
          { x: 1.5, y: -3 },
          { x: 0.4, y: -1.9 },
          { x: 0.4, y: 2.3 },
          { x: -0.4, y: 2.3 },
          { x: -0.4, y: -1.9 },
          { x: -1.5, y: -3 },
        ]}
      />
      <copperpour
        layer="bottom"
        connectsTo="net.GND"
        useThermalReliefs={false}
        outline={[
          { x: -1, y: -5.5 },
          { x: 1, y: -5.5 },
          { x: 1, y: 5.5 },
          { x: -1, y: 5.5 },
        ]}
      />
      <pcbnotetext text="UART ADAPTER / TOP COPPER" pcbY={7} fontSize={0.6} />
      <pcbnotetext
        text="Dead-end GND finger"
        pcbY={0.8}
        pcbX={3.9}
        fontSize={0.4}
      />
      <pcbnotepath
        route={[
          { x: 3.9, y: 1.2 },
          { x: 1.9, y: 2.7 },
          { x: 0, y: 2.3 },
        ]}
        color="#ffd54f"
      />
      <pcbnotetext
        text="GND pins connected on bottom copper"
        pcbY={-6.8}
        fontSize={0.45}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const errors = await runAllRoutingChecks(circuitJson)
  // The narrow top-layer tongue has no pad/via/trace at its tip, but passes DRC.
  expect(errors).toEqual([])
  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      layer: "top",
      width: 1400,
      height: 1200,
      viewport: { minX: -10.5, maxX: 10.5, minY: -8.6, maxY: 9.5 },
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
