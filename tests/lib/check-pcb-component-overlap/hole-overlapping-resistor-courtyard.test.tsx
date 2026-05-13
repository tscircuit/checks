import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

test("hole overlapping resistor courtyard should show footprint overlap error", async () => {
  const circuit = new Circuit()

  circuit.add(
    <board width="10mm" height="10mm">
      <resistor resistance="1k" footprint="0402" name="R1" pcbY={2.5} />
      <hole diameter="3mm" pcbX={0} pcbY={0} />
      <chip
        pcbX={-2}
        pcbY={-1}
        name="ANT1"
        footprint={
          <footprint>
            <courtyardoutline
              outline={[
                { x: -1, y: 0 },
                { x: 1, y: 0 },
                { x: 1, y: 1 },
                { x: 0, y: 2 },
                { x: -1, y: 1 },
              ]}
            />
          </footprint>
        }
      />
    </board>,
  )

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const errors = checkPcbComponentOverlap(circuitJson)
  const messages = errors.map((error) => error.message)

  expect(
    errors.every((error) => error.type === "pcb_footprint_overlap_error"),
  ).toBe(true)
  expect(
    errors.every((error) => error.pcb_hole_ids?.includes("pcb_hole_0")),
  ).toBe(true)
  expect(
    messages.some((message) => message.includes("pcb_courtyard_outline")),
  ).toBe(true)

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showCourtyards: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
