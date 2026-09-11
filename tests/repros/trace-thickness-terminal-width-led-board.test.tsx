import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { PcbTrace, SourceTrace } from "circuit-json"
import { Circuit } from "tscircuit"
import { checkSourceTracesMatchPcbTraceThickness } from "lib/check-source-traces-match-pcb-trace-thickness"

const LedPowerIndicatorBoard = () => (
  <board width="40mm" height="24mm" layers={2}>
    <battery
      name="BT1"
      voltage="3V"
      capacity="220mAh"
      footprint="pinrow2_p2.54"
      pcbX={-13}
      pcbY={0}
      doNotPlace
    />
    <resistor
      name="R1"
      resistance="330ohm"
      footprint="1206"
      pcbX={-2}
      pcbY={0}
      doNotPlace
    />
    <led
      name="LED1"
      color="green"
      footprint="1206"
      pinLabels={{ pin1: ["cathode", "neg"], pin2: ["anode", "pos"] }}
      pcbX={9}
      pcbY={0}
      doNotPlace
    />

    <trace from="BT1.pos" to="R1.pin1" thickness="0.3mm" />
    <trace from="R1.pin2" to="LED1.anode" thickness="0.15mm" />
    <trace from="LED1.cathode" to="BT1.neg" thickness="0.15mm" />
  </board>
)

test("undersized trace is missed when the terminal point is narrower", async () => {
  const circuit = new Circuit()
  circuit.add(<LedPowerIndicatorBoard />)
  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const sourceTrace = circuitJson.find(
    (element): element is SourceTrace =>
      element.type === "source_trace" && element.min_trace_thickness === 0.3,
  )
  const pcbTrace = circuitJson.find(
    (element): element is PcbTrace =>
      element.type === "pcb_trace" &&
      element.source_trace_id === sourceTrace?.source_trace_id,
  )

  expect(sourceTrace).toBeDefined()
  expect(pcbTrace).toBeDefined()
  if (!sourceTrace || !pcbTrace) return

  const wirePoints = pcbTrace.route.filter(
    (
      point,
    ): point is Extract<PcbTrace["route"][number], { route_type: "wire" }> =>
      point.route_type === "wire",
  )

  for (const point of wirePoints) point.width = 0.2
  const terminalPoint = wirePoints.at(-1)
  expect(terminalPoint).toBeDefined()
  if (!terminalPoint) return
  terminalPoint.width = 0.1

  const warnings = checkSourceTracesMatchPcbTraceThickness(circuitJson).filter(
    (warning) => warning.source_trace_id === sourceTrace.source_trace_id,
  )

  // Current incorrect behavior: the 0.1mm terminal point masks the real
  // 0.2mm routed segment, so no warning is produced for the requested 0.3mm.
  expect(warnings).toHaveLength(0)
  expect(convertCircuitJsonToPcbSvg(circuitJson)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
