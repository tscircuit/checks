import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { runAllPlacementChecks } from "../../lib/run-all-checks"

const onePin = { pin1: ["pin1"] } as const

export default function RotatedPillPadShort({
  pcbNoteText,
}: {
  pcbNoteText?: string
}) {
  return (
    <board width="12mm" height="12mm">
      <copperpour layer="bottom" connectsTo="net.GND" />

      <chip
        name="U1"
        pinLabels={onePin}
        pcbX={0}
        pcbY={0}
        pcbRotation={90}
        footprint={
          <footprint>
            <smtpad
              portHints={["pin1"]}
              pcbX={0}
              pcbY={0}
              width="0.5599938mm"
              height="1.7450054mm"
              radius="0.2799969mm"
              shape="pill"
            />
          </footprint>
        }
      />

      <chip
        name="X1"
        pinLabels={onePin}
        pcbX={1.127514}
        pcbY={0.445}
        footprint={
          <footprint>
            <smtpad
              portHints={["pin1"]}
              pcbX={0}
              pcbY={0}
              width="0.8mm"
              height="0.9mm"
              shape="rect"
            />
          </footprint>
        }
      />

      <trace from=".U1 > .pin1" to="net.V3_3" />
      <trace from=".X1 > .pin1" to="net.GND" />

      {pcbNoteText && (
        <pcbnotetext text={pcbNoteText} fontSize="0.25mm" pcbX={0} pcbY={-5} />
      )}
    </board>
  )
}

test("rotated pill overlapping a rectangular pad is missed", async () => {
  const circuit = new Circuit({
    platform: {
      placementDrcChecksDisabled: true,
    },
  })
  circuit.add(<RotatedPillPadShort />)
  await circuit.renderUntilSettled()

  const drcErrors = await runAllPlacementChecks(circuit.getCircuitJson())
  const errorMessages = drcErrors.map((error) => error.message).join(" | ")
  const pcbNoteText = `DRC error count: ${drcErrors.length}; DRC errors: ${errorMessages || "none"}`

  const annotatedCircuit = new Circuit({
    platform: {
      placementDrcChecksDisabled: true,
    },
  })
  annotatedCircuit.add(<RotatedPillPadShort pcbNoteText={pcbNoteText} />)
  await annotatedCircuit.renderUntilSettled()

  expect(
    convertCircuitJsonToPcbSvg(annotatedCircuit.getCircuitJson()),
  ).toMatchSvgSnapshot(import.meta.path)
})
