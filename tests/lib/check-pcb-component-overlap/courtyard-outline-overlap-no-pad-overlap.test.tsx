import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"
import { checkCourtyardOverlap } from "lib/check-courtyard-overlap/checkCourtyardOverlap"

/**
 * Two chips whose courtyard outlines overlap but whose pads are far enough
 * apart that they do NOT physically overlap.
 *
 * Layout (top view, all values in mm):
 *
 *  Chip1 centred at x=0   Chip2 centred at x=3
 *  courtyard: x ∈ [-2, 2]  courtyard: x ∈ [1, 5]
 *                         ↑ overlap zone x ∈ [1, 2]
 *
 *  U1 pads at absolute (-0.8, 0) and (0.8, 0), 0.8×0.8 mm
 *  U2 pads at absolute (2.2, 0) and (3.8, 0), 0.8×0.8 mm
 *  Closest pads: U1-pin2 @ x=1.2  vs  U2-pin1 @ x=1.8  → 0.6 mm gap, no overlap
 */

const ChipWithCourtyard = (props: { name: string; pcbX?: number }) => (
  <chip
    name={props.name}
    pcbX={props.pcbX ?? 0}
    pcbY={0}
    footprint={
      <footprint>
        {/* Two SMT pads placed symmetrically at ±0.8 mm from the component origin */}
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
        {/* Courtyard outline: 4 mm wide × 2 mm tall rectangle */}
        <courtyardoutline
          outline={[
            { x: -2, y: -1 },
            { x: 2, y: -1 },
            { x: 2, y: 1 },
            { x: -2, y: 1 },
            { x: -2, y: -1 },
          ]}
        />
      </footprint>
    }
  />
)

test("courtyard outlines overlap but pads do not – no pad overlap error", async () => {
  const circuit = new Circuit()

  circuit.add(
    <board width="20mm" height="10mm">
      {/* Chip1 at x=0: courtyard x ∈ [-2, 2] */}
      <ChipWithCourtyard name="U1" pcbX={0} />
      {/* Chip2 at x=3.5: courtyard x ∈ [1.5, 5.5] → overlaps with Chip1 in [1, 2] */}
      <ChipWithCourtyard name="U2" pcbX={3.5} />
    </board>,
  )

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()

  // Verify courtyard elements were emitted
  const courtyardOutlines = circuitJson.filter(
    (el) => el.type === "pcb_courtyard_outline",
  )
  expect(courtyardOutlines.length).toBe(2)

  // The pad-overlap check should report NO errors because pads are 2 mm apart
  const padErrors = checkPcbComponentOverlap(circuitJson)
  expect(padErrors).toHaveLength(0)

  // The courtyard overlap check SHOULD detect an error
  const courtyardErrors = checkCourtyardOverlap(circuitJson)
  expect(courtyardErrors).toHaveLength(1)
  expect(courtyardErrors[0].type).toBe("pcb_courtyard_overlap_error")
  expect(courtyardErrors[0].pcb_component_ids).toHaveLength(2)

  // Visual snapshot with courtyard errors injected
  const allErrors = [...courtyardErrors]
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...allErrors], {
      shouldDrawErrors: true,
      showCourtyards: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
