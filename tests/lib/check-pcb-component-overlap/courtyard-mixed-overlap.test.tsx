import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkCourtyardOverlap } from "lib/check-courtyard-overlap/checkCourtyardOverlap"

/**
 * Three components with different courtyard types, all overlapping the center
 * component but not each other.
 *
 *  U1 (rect 4x4mm)    at (0,  0): spans x∈[-2,2], y∈[-2,2]
 *  U2 (circle r=2mm)  at (3,  3): spans x∈[1,5],  y∈[1,5]  → overlaps U1 top-right corner
 *  U3 (outline 4x4mm) at (3, -3): spans x∈[1,5],  y∈[-5,-1] → overlaps U1 bottom-right corner
 *
 * Expected: 2 errors (U1–U2, U1–U3). U2 and U3 do not overlap each other.
 */

const SQUARE_OUTLINE = [
  { x: -2, y: -2 },
  { x: 2, y: -2 },
  { x: 2, y: 2 },
  { x: -2, y: 2 },
  { x: -2, y: -2 },
]

test("mixed courtyard types – rect/circle/outline, 2 overlaps with center component", async () => {
  const circuit = new Circuit()

  circuit.add(
    <board width="20mm" height="20mm">
      {/* U1: rect courtyard in the middle */}
      <chip
        name="U1"
        pcbX={0}
        pcbY={0}
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
            <courtyardrect width="4mm" height="4mm" />
          </footprint>
        }
      />
      {/* U2: circle courtyard overlapping U1 top-right corner */}
      <capacitor
        name="C1"
        capacitance="10uF"
        pcbX={3}
        pcbY={3}
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
            <courtyardcircle radius="2mm" />
          </footprint>
        }
      />
      {/* U3: outline courtyard overlapping U1 bottom-right corner */}
      <resistor
        name="R1"
        resistance="10k"
        pcbX={3}
        pcbY={-3}
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
            <courtyardoutline outline={SQUARE_OUTLINE} />
          </footprint>
        }
      />
    </board>,
  )

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()

  const errors = checkCourtyardOverlap(circuitJson)

  expect(errors).toHaveLength(2)
  expect(errors.every((e) => e.type === "pcb_courtyard_overlap_error")).toBe(
    true,
  )

  // U1 overlaps both U2 and U3
  const u1Source = circuitJson.find(
    (el) => el.type === "source_component" && (el as any).name === "U1",
  ) as { source_component_id: string } | undefined
  const u1Comp = circuitJson.find(
    (el) =>
      el.type === "pcb_component" &&
      (el as any).source_component_id === u1Source?.source_component_id,
  ) as { pcb_component_id: string } | undefined

  expect(
    errors.every((e) => e.pcb_component_ids.includes(u1Comp!.pcb_component_id)),
  ).toBe(true)

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showCourtyards: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
