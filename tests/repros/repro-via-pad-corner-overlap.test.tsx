import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkViaPadClearance } from "../../lib/check-via-pad-clearance"
import {
  runAllRoutingChecks,
  runAllPlacementChecks,
} from "../../lib/run-all-checks"

const ManualViaPadCornerOverlap = ({
  overlapErrorCount,
}: {
  overlapErrorCount?: number
}) => (
  <board width="10mm" height="10mm" routingDisabled>
    <resistor
      name="R1"
      resistance="1k"
      footprint="0603"
      pcbX={0}
      pcbY={0}
      pcbRotation={90}
    />

    <trace from=".R1 > .pin1" to="net.SIG" />
    <trace from=".R1 > .pin2" to="net.GND" />

    {/* R1.pin1 is centered at (0, -0.825) with a 0.95mm x 0.8mm pad.
        The via center is outside both pad axes, while its 0.3mm copper radius
        reaches across the pad's bottom-right corner. */}
    <via
      name="VIA_GND_OVER_SIG_PAD"
      pcbX={0.5}
      pcbY={-1.4}
      fromLayer="top"
      toLayer="bottom"
      outerDiameter="0.6mm"
      holeDiameter="0.3mm"
      connectsTo="net.GND"
    />

    <pcbnotetext
      text="#241: GND via copper overlaps the R1.pin1 (SIG) corner"
      fontSize="0.2mm"
      pcbX={0}
      pcbY={3.9}
    />
    {overlapErrorCount !== undefined && (
      <pcbnotetext
        text={`via/pad clearance errors: ${overlapErrorCount}`}
        fontSize="0.2mm"
        pcbX={0}
        pcbY={-3.9}
      />
    )}
  </board>
)

test("issue #241: routing reports GND via copper overlapping the R1.pin1 SMD pad corner", async () => {
  const circuit = new Circuit({
    platform: {
      placementDrcChecksDisabled: true,
    },
  })
  circuit.add(<ManualViaPadCornerOverlap />)
  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const placementErrors = await runAllPlacementChecks(circuitJson)
  const viaPadOverlapErrors = checkViaPadClearance(circuitJson)
  // Copper contact is still a short even when the drill is outside the pad.
  expect(placementErrors).toEqual([])
  expect(await runAllRoutingChecks(circuitJson)).toEqual(
    expect.arrayContaining(viaPadOverlapErrors),
  )

  const annotatedCircuit = new Circuit({
    platform: {
      placementDrcChecksDisabled: true,
    },
  })
  annotatedCircuit.add(
    <ManualViaPadCornerOverlap
      overlapErrorCount={viaPadOverlapErrors.length}
    />,
  )
  await annotatedCircuit.renderUntilSettled()

  expect(
    convertCircuitJsonToPcbSvg(
      [...annotatedCircuit.getCircuitJson(), ...viaPadOverlapErrors],
      {
        shouldDrawErrors: true,
        showErrorsInTextOverlay: true,
      },
    ),
  ).toMatchSvgSnapshot(import.meta.path)

  expect(viaPadOverlapErrors).toHaveLength(1)
})
