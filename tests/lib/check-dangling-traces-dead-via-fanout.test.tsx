import { expect, test } from "bun:test"
import { Circuit, PcbTrace } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkDanglingTraces } from "../../lib/check-dangling-traces/check-dangling-traces"

// Pad U1.SIG keeps a real route to U2.SIG, plus an unused escape to a via.
test("a pad fanout ending at a via going nowhere has a dangling endpoint", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={8} height={5} schematicDisabled routingDisabled>
      <chip
        name="U1"
        pcbX={-2.5}
        pinLabels={{ pin1: "SIG" }}
        footprint={
          <footprint>
            <smtpad
              portHints={["pin1"]}
              shape="rect"
              width={0.6}
              height={0.6}
            />
          </footprint>
        }
      />
      <chip
        name="U2"
        pcbX={2.5}
        pinLabels={{ pin1: "SIG" }}
        footprint={
          <footprint>
            <smtpad
              portHints={["pin1"]}
              shape="rect"
              width={0.6}
              height={0.6}
            />
          </footprint>
        }
      />
      <trace from="U1.SIG" to="U2.SIG" />
      <pcbnotetext text="Dead fanout via" pcbX={-1} pcbY={2} fontSize={0.25} />
    </board>,
  )
  await circuit.renderUntilSettled()
  const sourceTrace = circuit.db.source_trace.list()[0]!
  const board = circuit.children[0]!
  board.add(
    new PcbTrace({
      source_trace_id: sourceTrace.source_trace_id,
      route: [
        { route_type: "wire", x: -2.5, y: 0, layer: "top", width: 0.2 },
        { route_type: "wire", x: 2.5, y: 0, layer: "top", width: 0.2 },
      ],
    }),
  )
  board.add(
    new PcbTrace({
      source_trace_id: sourceTrace.source_trace_id,
      route: [
        { route_type: "wire", x: -2.5, y: 0, layer: "top", width: 0.2 },
        { route_type: "wire", x: -1, y: 1.5, layer: "top", width: 0.2 },
        {
          route_type: "via",
          x: -1,
          y: 1.5,
          from_layer: "top",
          to_layer: "bottom",
          outer_diameter: 0.6,
        },
      ],
    }),
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const errors = checkDanglingTraces(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({ center: { x: -1, y: 1.5 } })
  expect(errors[0]!.message).toContain("dangling endpoint at (-1.00, 1.50)")
  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
