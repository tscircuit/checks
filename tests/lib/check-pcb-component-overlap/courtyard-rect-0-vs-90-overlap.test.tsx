import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkCourtyardOverlap } from "lib/check-courtyard-overlap/checkCourtyardOverlap"

/**
 * U1 at (0,0) 0°:    4×1mm courtyard → x∈[-2,2], y∈[-0.5,0.5]
 * U2 at (2.2,0) 90°: 4×1mm rotated 90° → x∈[1.7,2.7], y∈[-2,2]
 *   U1's corner (2,-0.5) falls inside U2
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

test("courtyard overlap: 0° vs 90° rotation", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width="20mm" height="10mm">
      <Chip name="U1" pcbX={0} />
      <Chip name="U2" pcbX={2.2} pcbRotation={90} />
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
