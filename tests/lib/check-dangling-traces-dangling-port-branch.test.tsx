import { expect, test } from "bun:test"
import { Circuit, PcbTrace } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"

// Both required pads connect, but a saved branch still has a free end.
test("source-associated branch has a free endpoint", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={7} height={5} schematicDisabled routingDisabled>
      {[
        { name: "TX", x: -1 },
        { name: "RX", x: 1 },
      ].map(({ name, x }) => (
        <chip
          key={name}
          name={name}
          pcbX={x}
          pcbY={-1}
          pinLabels={{ pin1: "SIGNAL" }}
          footprint={
            <footprint>
              <smtpad
                portHints={["pin1"]}
                width={0.4}
                height={0.4}
                shape="rect"
              />
            </footprint>
          }
        />
      ))}
      <trace from="TX.pin1" to="RX.pin1" />
      <pcbnotetext
        text="DANGLING BRANCH: CONNECTED TX AND RX"
        pcbX={0}
        pcbY={2.1}
        fontSize={0.21}
        color="white"
      />
      <pcbnotetext
        text="BROKEN: DRC reports 0 errors; expected 1"
        pcbX={0}
        pcbY={1.6}
        fontSize={0.19}
        color="#ff6b6b"
      />
      <pcbnotetext
        text="Free endpoint"
        pcbX={1.5}
        pcbY={0.9}
        fontSize={0.17}
        color="#ff6b6b"
      />
      <pcbnotetext text="TX pad" pcbX={-1} pcbY={-1.42} fontSize={0.18} />
      <pcbnotetext text="RX pad" pcbX={1} pcbY={-1.42} fontSize={0.18} />
      <pcbnotetext
        text="Both pads connect, but the extra branch is open."
        pcbX={0}
        pcbY={-1.9}
        fontSize={0.19}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  // Render the logical connection first so both copper fragments share its ID.
  const sourceTrace = circuit.db.source_trace.list()[0]!
  const board = circuit.children[0]!
  board.add(
    new PcbTrace({
      source_trace_id: sourceTrace.source_trace_id,
      route: [
        { route_type: "wire", x: -1, y: -1, layer: "top", width: 0.2 },
        { route_type: "wire", x: 1, y: -1, layer: "top", width: 0.2 },
      ],
    }),
  )
  board.add(
    new PcbTrace({
      source_trace_id: sourceTrace.source_trace_id,
      route: [
        { route_type: "wire", x: 0, y: -1, layer: "top", width: 0.2 },
        { route_type: "wire", x: 0, y: 1, layer: "top", width: 0.2 },
      ],
    }),
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const errors = checkTracesAreContiguous(circuitJson)
  // Record the missed error; the fix PR updates this assertion and snapshot.
  expect(errors).toHaveLength(0)
  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
