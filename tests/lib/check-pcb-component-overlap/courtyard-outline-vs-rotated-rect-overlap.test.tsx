import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkCourtyardOverlap } from "lib/check-courtyard-overlap/checkCourtyardOverlap"

/**
 * U1 at (0,0): outline courtyard 2.4×1.4mm → x∈[-1.2,1.2], y∈[-0.7,0.7]
 *   (matches pads at ±0.5mm with ~0.3mm courtyard margin)
 * U2 at (1.5,0) rotated 45°: rect courtyard 4×1mm
 *   U2's long edge crosses U1's bottom outline edge at x≈0.33
 *
 * Expected: 1 overlap error (U1–U2)
 */

const COURTYARD_OUTLINE = [
  { x: -1.2, y: -0.7 },
  { x: 1.2, y: -0.7 },
  { x: 1.2, y: 0.7 },
  { x: -1.2, y: 0.7 },
]

test("courtyard overlap: outline vs rotated rect", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width="20mm" height="10mm">
      <chip
        name="U1"
        pcbX={0}
        pcbY={0}
        footprint={
          <footprint>
            <smtpad
              portHints={["pin1"]}
              pcbX="-0.5mm"
              pcbY="0mm"
              width="0.8mm"
              height="0.8mm"
              shape="rect"
            />
            <smtpad
              portHints={["pin2"]}
              pcbX="0.5mm"
              pcbY="0mm"
              width="0.8mm"
              height="0.8mm"
              shape="rect"
            />
            <courtyardoutline outline={COURTYARD_OUTLINE} />
          </footprint>
        }
      />
      <chip
        name="U2"
        pcbX={2}
        pcbY={0}
        pcbRotation={45}
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
