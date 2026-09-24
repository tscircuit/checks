import { expect, test } from "bun:test"
import { Circuit, PcbTrace } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"

// AM3352 geometry translated by (-10.7, -1.3) mm to center the example.
// The 0.04999 mm stub overlaps its junction's rounded copper cap.
test("AM3352 short ground stub has a free endpoint", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={4.6} height={4} layers={4} schematicDisabled routingDisabled>
      <chip
        name="C_X1"
        pcbX={0.01}
        pcbY={-1}
        pinLabels={{ pin1: "GND" }}
        footprint={
          <footprint>
            <smtpad
              portHints={["pin1"]}
              width={0.2}
              height={0.2}
              shape="rect"
            />
          </footprint>
        }
      />
      <trace from="C_X1.GND" to="net.GND" />
      <via
        name="GND_VIA"
        pcbX={0.125}
        pcbY={-0.125}
        outerDiameter={0.3}
        holeDiameter={0.15}
        fromLayer="top"
        toLayer="bottom"
        connectsTo="net.GND"
      />
      <pcbnotetext
        text="AM3352: SHORT GND STUB PAST A VIA"
        pcbY={1.7}
        fontSize={0.15}
        color="white"
      />
      <pcbnotetext
        text="BROKEN: DRC reports 0 errors; expected 1"
        pcbY={1.35}
        fontSize={0.14}
        color="#ff6b6b"
      />
      <pcbnotetext
        text="0.04999 mm tip overlaps the junction copper cap"
        pcbY={0.98}
        fontSize={0.135}
      />
      <pcbnotetext
        text="Free tip"
        pcbY={0.62}
        fontSize={0.13}
        color="#ff6b6b"
      />
      <pcbnotetext text="GND via" pcbX={1.05} pcbY={-0.13} fontSize={0.13} />
      <pcbnotetext
        text="C_X1 GND pad"
        pcbX={0.01}
        pcbY={-1.25}
        fontSize={0.13}
      />
      <pcbnotetext
        text="Copper contact at the base does not terminate the tip."
        pcbY={-1.65}
        fontSize={0.13}
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
        { route_type: "wire", x: 0.175, y: 0.1, layer: "top", width: 0.1 },
        { route_type: "wire", x: 0.175, y: 0.14999, layer: "top", width: 0.1 },
      ],
    }),
  )
  board.add(
    new PcbTrace({
      source_trace_id: sourceTrace.source_trace_id,
      route: [
        { route_type: "wire", x: 0.175, y: 0.1, layer: "top", width: 0.1 },
        { route_type: "wire", x: 0.01, y: -1, layer: "top", width: 0.1 },
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
