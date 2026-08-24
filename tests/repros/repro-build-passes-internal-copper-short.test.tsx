import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { runAllChecks } from "../../lib/run-all-checks"

const pinLabels = {
  pin1: ["A"],
  pin2: ["B"],
} as const

const ReproCircuit = ({ note }: { note?: string }) => (
  <board width="12mm" height="8mm">
    <chip
      name="U1"
      pinLabels={pinLabels}
      footprint={
        <footprint>
          <smtpad
            portHints={["pin1"]}
            pcbX={-0.2}
            pcbY={0}
            width="0.6mm"
            height="1mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin2"]}
            pcbX={0.2}
            pcbY={0}
            width="0.6mm"
            height="1mm"
            shape="rect"
          />
        </footprint>
      }
    />
    <resistor name="R1" resistance="1k" footprint="0603" pcbX={-3} />
    <resistor name="R2" resistance="1k" footprint="0603" pcbX={3} />
    <trace from=".R1 > .pin1" to=".U1 > .A" />
    <trace from=".R2 > .pin1" to=".U1 > .B" />
    {note && <pcbnotetext text={note} pcbX={0} pcbY={-3} fontSize="0.3mm" />}
  </board>
)

test("aggregate checks miss a physical short between different nets inside one footprint", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(<ReproCircuit />)
  await circuit.renderUntilSettled()

  const errors = await runAllChecks(circuit.getCircuitJson())
  const shortErrors = errors.filter((error) =>
    error.message.toLowerCase().includes("overlap"),
  )

  const annotatedCircuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  annotatedCircuit.add(
    <ReproCircuit
      note={`Different nets physically overlap; overlap errors: ${shortErrors.length}`}
    />,
  )
  await annotatedCircuit.renderUntilSettled()

  expect(shortErrors).toHaveLength(0)
  expect(
    convertCircuitJsonToPcbSvg(annotatedCircuit.getCircuitJson()),
  ).toMatchSvgSnapshot(import.meta.path)
})
