import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { pcb_note_text } from "circuit-json"
import { runAllRoutingChecks } from "../../index"

test("ground-island connectivity with local trace stubs", async () => {
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
  // routingDisabled preserves the gap; invoke routing DRC explicitly.
  const errors = await runAllRoutingChecks(circuitJson)
  expect(errors).toHaveLength(2)
  expect(
    errors.every((error) => error.type === "pcb_port_not_connected_error"),
  ).toBe(true)

  circuitJson.push(
    pcb_note_text.parse({
      type: "pcb_note_text",
      text: `Expected 2 connection errors; reported ${errors.length}`,
      anchor_position: { x: 0, y: 3 },
      font_size: 0.5,
      color: "red",
    }),
  )
  expect(convertCircuitJsonToPcbSvg(circuitJson)).toMatchSvgSnapshot(
    import.meta.path,
  )
})

test("a bridge trace connects pads on separate ground pours", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={18} height={8} routingDisabled>
      <net name="GND" isGroundNet />
      <testpoint name="TP1" pcbX={-5} footprintVariant="pad" padDiameter={1} />
      <testpoint name="TP2" pcbX={5} footprintVariant="pad" padDiameter={1} />
      <trace from=".TP1 > .pin1" to="net.GND" pcbPath={[{ x: 1, y: 0 }]} />
      <trace from=".TP2 > .pin1" to="net.GND" pcbPath={[{ x: 1, y: 0 }]} />
      <trace from=".TP1 > .pin1" to=".TP2 > .pin1" pcbStraightLine />
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
  expect(
    circuitJson.filter((element) => element.type === "pcb_trace"),
  ).toHaveLength(3)
  expect(await runAllRoutingChecks(circuitJson)).toHaveLength(0)
})

test("a trace-only net does not require a copper pour", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={18} height={8} routingDisabled>
      <net name="VCC" />
      <testpoint name="TP1" pcbX={-5} footprintVariant="pad" padDiameter={1} />
      <testpoint name="TP2" pcbX={5} footprintVariant="pad" padDiameter={1} />
      <trace from=".TP1 > .pin1" to="net.VCC" pcbPath={[".TP2 > .pin1"]} />
      <trace from=".TP2 > .pin1" to="net.VCC" />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  expect(
    circuitJson.filter((element) => element.type === "pcb_trace"),
  ).toHaveLength(1)
  expect(await runAllRoutingChecks(circuitJson)).toHaveLength(0)
})

test("power-island connectivity with a port-to-port requirement", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={18} height={8} routingDisabled schAutoLayoutEnabled>
      <net name="VCC" isPowerNet />
      <testpoint name="TP1" pcbX={-5} footprintVariant="pad" padDiameter={1} />
      <testpoint name="TP2" pcbX={5} footprintVariant="pad" padDiameter={1} />
      <trace from=".TP1 > .pin1" to="net.VCC" pcbPath={[{ x: 1, y: 0 }]} />
      <trace from=".TP2 > .pin1" to="net.VCC" pcbPath={[{ x: 1, y: 0 }]} />
      <trace from=".TP1 > .pin1" to=".TP2 > .pin1" />
      <copperpour
        layer="top"
        connectsTo="net.VCC"
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
        connectsTo="net.VCC"
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
  // routingDisabled preserves the gap; invoke routing DRC explicitly.
  const errors = await runAllRoutingChecks(circuitJson)
  expect(errors).toHaveLength(3)
  expect(
    errors.every((error) => error.type === "pcb_port_not_connected_error"),
  ).toBe(true)
})
