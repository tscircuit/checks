import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { Circuit } from "tscircuit"

const Branch = ({
  id,
  shuntX,
  linkX,
}: {
  id: "1" | "2" | "3"
  shuntX: number
  linkX: number
}) => (
  <>
    <resistor
      name={`R_SHUNT_${id}`}
      resistance="5m"
      footprint="2512"
      pcbX={shuntX}
      pcbY={0}
      pcbRotation={90}
    />
    <resistor
      name={`R_LINK_${id}`}
      resistance="0"
      footprint="0402"
      pcbX={linkX}
      pcbY={-8}
      pcbRotation={270}
    />
    <trace from={`.R_SHUNT_${id} > .pin2`} to="net.GND" />
    <trace from={`.R_SHUNT_${id} > .pin2`} to={`.R_LINK_${id} > .pin1`} />
  </>
)

const SharedGroundKelvinRepro = () => (
  <board width="50mm" height="30mm">
    <net name="GND" isGroundNet />
    <Branch id="1" shuntX={-15} linkX={8} />
    <Branch id="2" shuntX={0} linkX={10} />
    <Branch id="3" shuntX={15} linkX={12} />
  </board>
)

test("same-net routed branch should satisfy the required PCB port", async () => {
  const circuit = new Circuit({
    platform: {
      netlistDrcChecksDisabled: true,
      placementDrcChecksDisabled: true,
    },
  })
  circuit.add(<SharedGroundKelvinRepro />)

  await circuit.renderUntilSettled()

  const circuitJson = circuit
    .getCircuitJson()
    .filter((element) => element.type !== "pcb_trace_error")
  const errors = checkTracesAreContiguous(circuitJson)

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
  expect(errors).toHaveLength(0)
}, 30_000)
