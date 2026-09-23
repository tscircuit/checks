import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbTraceSelfShorts } from "../../index"
import {
  LengthTestTerminal,
  renderLengthTestBoard,
} from "../fixtures/length-matching-visual"

const SelfShortBoard = ({ message }: { message?: string }) => (
  <board
    width={28}
    height={20}
    pcbStyle={{ viaPadDiameter: 0.7, viaHoleDiameter: 0.3 }}
    routingDisabled
    schematicDisabled
  >
    <LengthTestTerminal name="TX" x={-9} y={-3} />
    <chip
      name="RX"
      pcbX={-9}
      pcbY={1}
      layer="bottom"
      pinLabels={{ pin1: "SIGNAL" }}
      footprint={
        <footprint>
          <smtpad
            portHints={["pin1"]}
            pcbX={0}
            pcbY={0}
            width={1}
            height={1}
            shape="rect"
          />
        </footprint>
      }
    />
    <trace
      name="DATA_P"
      from=".TX > .pin1"
      to=".RX > .pin1"
      thickness={0.25}
      pcbPathRelativeTo=".TX > .pin1"
      pcbPath={[
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 2 },
        { x: 15, y: 2 },
        { x: 15, y: 7 },
        { x: 9, y: 7 },
        { x: 9, y: 2.4, via: true, fromLayer: "top", toLayer: "bottom" },
        { x: 6, y: 2.4 },
        { x: 6, y: 4 },
        { x: 0, y: 4 },
      ]}
    />
    <pcbnotetext text="DATA_P: VIA SELF-SHORT" pcbY={8} fontSize={1.2} />
    <pcbnotetext text="TX" pcbX={-11} pcbY={-3} fontSize={0.8} />
    <pcbnotetext text="RX" pcbX={-11} pcbY={1} fontSize={0.8} />
    {message && (
      <pcbnotetext
        text={message.replace(", ", ",\n")}
        pcbY={-7}
        fontSize={0.65}
        color="#ff6b6b"
      />
    )}
  </board>
)

async function renderMatchedBoard(message?: string) {
  const json = await renderLengthTestBoard(<SelfShortBoard message={message} />)
  const source = json.find(
    (e) => e.type === "source_trace" && e.name === "DATA_P",
  )!
  if (source.type !== "source_trace") throw new Error("Missing DATA_P")
  json.push({
    type: "source_bus",
    source_bus_id: "matched_bus",
    source_trace_ids: [source.source_trace_id],
    max_length_skew: 0.1,
  })
  return json
}

test("shows a subtle via self-short without crossing trace centerlines", async () => {
  const json = await renderMatchedBoard()
  const errors = checkPcbTraceSelfShorts(json)
  expect(errors).toHaveLength(1)
  expect(errors[0]!.message).toContain('"DATA_P"')
  expect(errors[0]!.center?.x).toBeCloseTo(0)
  expect(errors[0]!.center?.y).toBeCloseTo(-0.8)
  // Shrinking only the via copper must remove the short: wires do not overlap.
  const noViaCopper = structuredClone(json)
  for (const element of noViaCopper) {
    if (element.type === "pcb_via") element.outer_diameter = 0.3
    if (element.type === "pcb_trace")
      for (const point of element.route) {
        if (point.route_type === "via") point.outer_diameter = 0.3
      }
  }
  expect(checkPcbTraceSelfShorts(noViaCopper)).toEqual([])
  const annotated = await renderMatchedBoard(errors[0]!.message)
  const annotatedErrors = checkPcbTraceSelfShorts(annotated)
  expect(annotatedErrors).toEqual(errors)
  await expect(
    convertCircuitJsonToPcbSvg(annotated, {
      width: 1000,
      height: 750,
      // Keep the via land visible; the readable diagnostic is below the route.
      shouldDrawErrors: false,
    }),
  ).toMatchSvgSnapshot(import.meta.path)

  const source = json.find(
    (e) => e.type === "source_trace" && e.name === "DATA_P",
  )!
  if (source.type === "source_trace") {
    delete source.name
    delete source.display_name
  }
  expect(checkPcbTraceSelfShorts(json)[0]!.message).toContain(
    '"TX.SIGNAL → RX.SIGNAL"',
  )
})
