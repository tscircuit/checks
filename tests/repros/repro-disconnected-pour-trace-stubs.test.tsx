import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { runAllRoutingChecks } from "../../index"

test("repro: local trace stubs hide disconnected ground islands", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={18} height={8} routingDisabled schAutoLayoutEnabled>
      <net name="GND" isGroundNet />
      <testpoint name="TP1" pcbX={-5} footprintVariant="pad" padDiameter={1} />
      <testpoint name="TP2" pcbX={5} footprintVariant="pad" padDiameter={1} />
      <trace from=".TP1 > .pin1" to="net.GND" pcbPath={[{ x: 1, y: 0 }]} />
      <trace from=".TP2 > .pin1" to="net.GND" pcbPath={[{ x: 1, y: 0 }]} />
      <copperpour
        layer="top"
        connectsTo="net.GND"
        useThermalReliefs={false}
        outline={[
          { x: -7, y: -2 },
          { x: -3, y: -2 },
          { x: -3, y: 2 },
          { x: -7, y: 2 },
        ]}
      />
      <copperpour
        layer="top"
        connectsTo="net.GND"
        useThermalReliefs={false}
        outline={[
          { x: 3, y: -2 },
          { x: 7, y: -2 },
          { x: 7, y: 2 },
          { x: 3, y: 2 },
        ]}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const traces = circuitJson.filter((element) => element.type === "pcb_trace")
  const pours = circuitJson.filter(
    (element) => element.type === "pcb_copper_pour",
  )
  expect(traces).toHaveLength(2)
  expect(traces.map((trace) => trace.trace_length)).toEqual([1, 1])
  expect(pours).toHaveLength(2)
  expect(pours[0].source_net_id).toBe(pours[1].source_net_id)
  expect(convertCircuitJsonToPcbSvg(circuitJson)).toMatchSvgSnapshot(
    import.meta.path,
  )

  // routingDisabled preserves the gap; invoke routing DRC explicitly.
  const errors = await runAllRoutingChecks(circuitJson)
  // Current bug: both required ground connections should be reported.
  expect(errors).toHaveLength(0)
})
