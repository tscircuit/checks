import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { Circuit } from "tscircuit"

const Phase = ({
  phase,
  shuntX,
  linkX,
}: {
  phase: "A" | "B" | "C"
  shuntX: number
  linkX: number
}) => (
  <>
    <resistor
      name={"R_SHUNT_" + phase}
      resistance="5m"
      footprint="2512"
      pcbX={shuntX}
      pcbY={0}
      pcbRotation={90}
    />
    <resistor
      name={"R_CS" + phase + "_N_LINK"}
      resistance="0"
      footprint="0402"
      pcbX={linkX}
      pcbY={-8}
      pcbRotation={270}
    />
    <resistor
      name={"R_SENSE_" + phase}
      resistance="10k"
      footprint="0402"
      pcbX={linkX}
      pcbY={-12}
    />
    <trace
      name={phase + "_SHUNT_GND"}
      from={".R_SHUNT_" + phase + " > .pin2"}
      to="net.GND"
    />
    <trace
      name={phase + "_SHUNT_SENSE_NEG_KELVIN"}
      from={".R_SHUNT_" + phase + " > .pin2"}
      to={".R_CS" + phase + "_N_LINK > .pin1"}
    />
    <trace
      name={phase + "_SENSE_INPUT"}
      from={".R_CS" + phase + "_N_LINK > .pin2"}
      to={".R_SENSE_" + phase + " > .pin1"}
    />
    <trace
      name={phase + "_SENSE_RETURN"}
      from={".R_SENSE_" + phase + " > .pin2"}
      to="net.GND"
    />
  </>
)

const SharedGroundKelvinRepro = () => (
  <board width="50mm" height="30mm">
    <net name="GND" isGroundNet />
    <copperpour name="GND_TOP" layer="top" connectsTo="net.GND" />
    <Phase phase="A" shuntX={-15} linkX={8} />
    <Phase phase="B" shuntX={0} linkX={10} />
    <Phase phase="C" shuntX={15} linkX={12} />
  </board>
)

test.failing(
  "same-net routed branch should satisfy the required PCB port",
  async () => {
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

    expect(convertCircuitJsonToPcbSvg(circuitJson)).toMatchSvgSnapshot(
      import.meta.path,
    )
    expect(errors).toHaveLength(0)
  },
  30_000,
)
