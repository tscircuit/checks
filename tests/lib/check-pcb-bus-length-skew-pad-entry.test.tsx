import { expect, test } from "bun:test"
import type { PcbTrace, PcbTraceRoutePointWire } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { measureRoute } from "../../lib/util/measure-route"
import { checkPcbBusLengthSkew } from "../../lib/check-pcb-bus-length-skew"
import {
  LengthTestTerminal,
  renderLengthTestBoard,
} from "../fixtures/length-matching-visual"

test("measures a strobe entering its receiver pad off center", async () => {
  const circuitJson = await renderLengthTestBoard(
    <board width={14} height={8} routingDisabled schematicDisabled>
      <LengthTestTerminal name="TX1" x={-4} y={1} />
      <LengthTestTerminal name="RX1" x={4} y={1} />
      <LengthTestTerminal name="TX2" x={-4} y={-1} />
      <LengthTestTerminal name="RX2" x={4} y={-1} />
      <trace name="DQS_P" from=".TX1 > .pin1" to=".RX1 > .pin1" />
      <trace name="DQS_N" from=".TX2 > .pin1" to=".RX2 > .pin1" />
      <bus name="DQS" connections={["DQS_P", "DQS_N"]} maxLengthSkew={0.01} />
    </board>,
  )
  const wire = (x: number, y: number): PcbTraceRoutePointWire => ({
    route_type: "wire",
    layer: "top",
    width: 0.1565,
    x,
    y,
  })
  const routes: PcbTrace["route"][] = [
    [wire(-4, 1), wire(4, 1)],
    [
      wire(-4, -1),
      {
        route_type: "via",
        x: -2,
        y: -1,
        from_layer: "top",
        to_layer: "bottom",
      },
      { ...wire(-2, -1), layer: "bottom" },
      { ...wire(2, -1), layer: "bottom" },
      { route_type: "via", x: 2, y: -1, from_layer: "bottom", to_layer: "top" },
      wire(3.8, -1),
    ],
  ]
  for (const [index, name] of ["DQS_P", "DQS_N"].entries()) {
    const source = circuitJson.find(
      (e) => e.type === "source_trace" && e.name === name,
    )
    if (source?.type !== "source_trace")
      throw new Error(`Missing ${name} trace`)
    circuitJson.push({
      type: "pcb_trace",
      pcb_trace_id: name,
      source_trace_id: source.source_trace_id,
      route: routes[index]!,
    })
  }

  const [error] = checkPcbBusLengthSkew(circuitJson)
  expect(error).toBeUndefined()
  circuitJson.push({
    type: "pcb_note_text",
    pcb_note_text_id: "measurement",
    layer: "top",
    anchor_position: { x: 0, y: 2.6 },
    anchor_alignment: "center",
    font: "tscircuit2024",
    font_size: 0.48,
    text: `DQS   8 mm pad to pad   ${(error?.actual_length_skew ?? 0).toFixed(2)} mm skew`,
  })
  await expect(
    convertCircuitJsonToPcbSvg(circuitJson, { includeVersion: false }),
  ).toMatchSvgSnapshot(import.meta.path)
  const strobe = circuitJson.find(
    (e) => e.type === "source_trace" && e.name === "DQS_N",
  )
  const track = circuitJson.find(
    (e) => e.type === "pcb_trace" && e.pcb_trace_id === "DQS_N",
  )
  if (strobe?.type !== "source_trace" || track?.type !== "pcb_trace")
    throw new Error("Missing DQS_N route")
  const measureStrobe = () => measureRoute(strobe, [track], circuitJson)
  expect(measureStrobe()?.length).toBeCloseTo(8)
  track.route[track.route.length - 1] = wire(4.2, -1)
  expect(measureStrobe()?.length).toBeCloseTo(8)
  // The same route ending in the gap beside the receiver cannot be timed.
  track.route[track.route.length - 1] = wire(3.4, -1)
  expect(measureStrobe()).toBeUndefined()
})
