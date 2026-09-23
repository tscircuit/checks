import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbTraceSelfShorts } from "../../index"
import {
  LengthTestTerminal,
  renderLengthTestBoard,
} from "../fixtures/length-matching-visual"

const SelfShortBoard = ({ message }: { message?: string }) => (
  <board width={32} height={24} routingDisabled schematicDisabled>
    <LengthTestTerminal name="TX" x={-8} y={-4} />
    <LengthTestTerminal name="RX" x={8} y={-4} />
    <trace
      name="DATA_P"
      from=".TX > .pin1"
      to=".RX > .pin1"
      thickness={0.35}
      pcbPathRelativeTo=".TX > .pin1"
      pcbPath={[
        { x: 0, y: 0 },
        { x: 16, y: 8 },
        { x: 0, y: 8 },
        { x: 16, y: 0 },
      ]}
    />
    <pcbnotetext text="DATA_P: SELF-SHORT" pcbY={9} fontSize={1.2} />
    <pcbnotetext text="TX" pcbX={-10} pcbY={-4} fontSize={0.8} />
    <pcbnotetext text="RX" pcbX={10} pcbY={-4} fontSize={0.8} />
    {message && (
      <pcbnotetext
        text={message.replace(", ", ",\n")}
        pcbY={-8}
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

test("shows the self-short marker and readable diagnostic on the PCB", async () => {
  const json = await renderMatchedBoard()
  const errors = checkPcbTraceSelfShorts(json)
  expect(errors).toHaveLength(1)
  expect(errors[0]!.message).toContain('"DATA_P"')
  expect(errors[0]!.center).toEqual({ x: 0, y: 0 })
  const annotated = await renderMatchedBoard(errors[0]!.message)
  const annotatedErrors = checkPcbTraceSelfShorts(annotated)
  expect(annotatedErrors).toEqual(errors)
  await expect(
    convertCircuitJsonToPcbSvg([...annotated, ...annotatedErrors], {
      width: 1000,
      height: 750,
      shouldDrawErrors: true,
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
