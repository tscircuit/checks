import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { EC10E1220505 } from "../../imports/EC10E1220505"
import { checkPadPadClearance } from "../../lib/check-pad-pad-clearance"

test("reproduces false EC10E1220505 plated-pill clearance errors", async () => {
  const circuit = new Circuit({
    platform: {
      netlistDrcChecksDisabled: true,
      placementDrcChecksDisabled: true,
    },
  })

  circuit.add(
    <board width="12mm" height="14mm">
      <EC10E1220505 name="ENC_WHEEL" pcbRotation={90} />
    </board>,
  )
  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const errors = checkPadPadClearance(circuitJson)

  expect(errors).toHaveLength(2)
  expect(errors.every((error) => error.actual_clearance === 0)).toBe(true)
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
