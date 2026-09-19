import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

test("do-not-place components still report plated-hole overlaps", async () => {
  const circuit = new Circuit({
    platform: {
      netlistDrcChecksDisabled: true,
      placementDrcChecksDisabled: true,
    },
  })
  circuit.add(
    <board width="10mm" height="10mm" routingDisabled>
      <jumper
        name="JP1"
        doNotPlace
        cadModel={null}
        footprint="pinrow2_id1.016_od1.88_p2.54"
        pcbX={0}
        pcbY={0}
      />
      <jumper
        name="JP2"
        doNotPlace
        cadModel={null}
        footprint="pinrow2_id1.016_od1.88_p2.54"
        pcbX={0}
        pcbY={0}
      />
    </board>,
  )

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const errors = checkPcbComponentOverlap(circuitJson)

  expect(errors).toHaveLength(2)
  expect(
    errors.flatMap((error) => error.pcb_plated_hole_ids ?? []),
  ).toHaveLength(4)
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      showCourtyards: true,
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
