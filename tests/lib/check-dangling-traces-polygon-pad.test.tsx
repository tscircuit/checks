import { expect, test } from "bun:test"
import { Circuit, PcbTrace } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkDanglingTraces } from "../../lib/check-dangling-traces/check-dangling-traces"

// Footprints imported from CAD libraries can repeat polygon vertices. Such a pad
// must not stop free trace ends elsewhere on its layer from being reported.
test("a polygon pad with a repeated vertex does not hide a free trace end", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={8} height={5} schematicDisabled routingDisabled>
      <chip
        name="J1"
        pcbX={-2.5}
        pinLabels={{ pin1: "SIG" }}
        footprint={
          <footprint>
            <smtpad
              portHints={["pin1"]}
              shape="polygon"
              points={[
                { x: -0.5, y: -0.5 },
                { x: 0.5, y: -0.5 },
                { x: 0.5, y: -0.5 },
                { x: 0.5, y: 0.5 },
                { x: -0.5, y: 0.5 },
                { x: -0.5, y: -0.5 },
              ]}
            />
          </footprint>
        }
      />
      <trace from="J1.SIG" to="net.SIG" />
      <pcbnotetext
        text="Polygon pad repeats a vertex"
        pcbY={2}
        fontSize={0.25}
      />
      <pcbnotetext text="Free tip" pcbX={2.5} pcbY={0.4} fontSize={0.25} />
    </board>,
  )
  await circuit.renderUntilSettled()
  const sourceTrace = circuit.db.source_trace.list()[0]!
  circuit.children[0]!.add(
    new PcbTrace({
      source_trace_id: sourceTrace.source_trace_id,
      route: [
        { route_type: "wire", x: -2.5, y: 0, layer: "top", width: 0.2 },
        { route_type: "wire", x: 2.5, y: 0, layer: "top", width: 0.2 },
      ],
    }),
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const errors = checkDanglingTraces(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({ center: { x: 2.5, y: 0 } })
  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
