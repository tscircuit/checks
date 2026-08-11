import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkCourtyardOverlap } from "lib/check-courtyard-overlap/checkCourtyardOverlap"

/**
 * U1 at (0,0) 30°:  4×1mm rotated 30° → rightmost corner at x≈1.98
 * U2 at (2,0) 60°:  4×1mm rotated 60° → leftmost corner at x≈0.57
 *   U1's rightmost corner falls inside U2's polygon
 *
 * Expected: 1 overlap error (U1–U2)
 */

const Chip = (props: { name: string; pcbX: number; pcbRotation?: number }) => (
  <chip
    name={props.name}
    pcbX={props.pcbX}
    pcbY={0}
    pcbRotation={props.pcbRotation}
    footprint={
      <footprint>
        <smtpad
          portHints={["pin1"]}
          pcbX="-0.8mm"
          pcbY="0mm"
          width="0.8mm"
          height="0.8mm"
          shape="rect"
        />
        <smtpad
          portHints={["pin2"]}
          pcbX="0.8mm"
          pcbY="0mm"
          width="0.8mm"
          height="0.8mm"
          shape="rect"
        />
        <courtyardrect width="4mm" height="1mm" />
      </footprint>
    }
  />
)

test("courtyard overlap: 30° vs 60° rotation", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width="20mm" height="10mm">
      <Chip name="U1" pcbX={0} pcbRotation={30} />
      <Chip name="U2" pcbX={2} pcbRotation={60} />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()

  const errors = checkCourtyardOverlap(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].type).toBe("pcb_courtyard_overlap_error")
  expect(errors[0].pcb_component_ids).toHaveLength(2)

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showCourtyards: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
