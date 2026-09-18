import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbBusLengthSkew } from "../../lib/check-pcb-bus-length-skew"
import {
  LengthTestTerminal,
  renderLengthTestBoard,
} from "../fixtures/length-matching-visual"

const BusSkewViolation = ({ errorMessage }: { errorMessage?: string }) => (
  <board width={44} height={34} routingDisabled schematicDisabled>
    <bus name="DATA" connections={["D0", "D1"]} maxLengthSkew="2mm" />
    <LengthTestTerminal name="TX0" x={-10} y={6} />
    <LengthTestTerminal name="RX0" x={10} y={6} />
    <LengthTestTerminal name="TX1" x={-10} y={0} />
    <LengthTestTerminal name="RX1" x={10} y={0} />
    <trace
      name="D0"
      from=".TX0 > .pin1"
      to=".RX0 > .pin1"
      thickness={0.35}
      pcbPathRelativeTo=".TX0 > .pin1"
      pcbPath={[
        { x: 0, y: 0 },
        { x: 20, y: 0 },
      ]}
    />
    <trace
      name="D1"
      from=".TX1 > .pin1"
      to=".RX1 > .pin1"
      thickness={0.35}
      pcbPathRelativeTo=".TX1 > .pin1"
      pcbPath={[
        { x: 0, y: 0 },
        { x: 0, y: -5 },
        { x: 20, y: -5 },
        { x: 20, y: 0 },
      ]}
    />

    <pcbnotetext
      text="DATA BUS: LENGTH-SKEW VIOLATION"
      pcbY={14}
      fontSize={1.15}
      color="white"
    />
    <pcbnotetext
      text="maxLengthSkew = 2 mm"
      pcbY={11.5}
      fontSize={1}
      color="#ffd166"
    />
    <pcbnotetext text="D0: 20 mm total" pcbY={8.3} fontSize={0.9} />
    <pcbnotetext text="20 mm" pcbY={4.5} fontSize={0.8} />
    <pcbnotetext text="D1: 30 mm total" pcbY={1.8} fontSize={0.9} />
    <pcbnotetext text="5 mm" pcbX={-13} pcbY={-2.5} fontSize={0.8} />
    <pcbnotetext text="5 mm" pcbX={13} pcbY={-2.5} fontSize={0.8} />
    <pcbnotetext text="20 mm" pcbY={-6.5} fontSize={0.8} />
    <pcbnotetext
      text="Skew = 30 - 20 = 10 mm > 2 mm allowed"
      pcbY={-9.5}
      fontSize={1}
      color="#ff6b6b"
    />
    {errorMessage?.split(", ").map((line, index) => (
      <pcbnotetext
        text={index === 0 ? `DRC: ${line}` : line}
        pcbY={-12.5 - index * 1.8}
        fontSize={0.8}
        color="#ff6b6b"
      />
    ))}
  </board>
)

test("bus skew DRC is explained on the PCB beside the measured routes", async () => {
  const circuit = await renderLengthTestBoard(<BusSkewViolation />)
  const errors = checkPcbBusLengthSkew(circuit)
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_bus_length_skew_error",
    actual_length_skew: 10,
    maximum_length_skew: 2,
  })
  const annotated = await renderLengthTestBoard(
    <BusSkewViolation errorMessage={errors[0].message} />,
  )
  expect(checkPcbBusLengthSkew(annotated)).toEqual(errors)
  expect(
    convertCircuitJsonToPcbSvg([...annotated, ...errors], {
      width: 1000,
      height: 800,
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
