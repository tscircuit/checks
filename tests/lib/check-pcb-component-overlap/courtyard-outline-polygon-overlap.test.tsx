import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkCourtyardOverlap } from "lib/check-courtyard-overlap/checkCourtyardOverlap"

/**
 * Three chips with a hexagonal courtyardoutline (circumradius 2 mm).
 *
 *  U1 at x=0:   hex spans x ∈ [-2, 2]
 *  U2 at x=3:   hex spans x ∈ [1, 5]  → overlaps U1 in x ∈ [1, 2]
 *  U3 at x=10:  hex spans x ∈ [8, 12] → no overlap
 *
 * Expected: 1 error (U1–U2), U3 is clear.
 */

const HEX_R = 2 // mm – circumradius
const HEX_VERTS = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i
  return {
    x: +(HEX_R * Math.cos(a)).toFixed(4),
    y: +(HEX_R * Math.sin(a)).toFixed(4),
  }
})
const HEX_OUTLINE = [...HEX_VERTS, HEX_VERTS[0]]

const ChipWithHexOutline = (props: { name: string; pcbX?: number }) => (
  <chip
    name={props.name}
    pcbX={props.pcbX ?? 0}
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
        <courtyardoutline outline={HEX_OUTLINE} />
      </footprint>
    }
  />
)

test("courtyard outline (hexagon) – U1 and U2 overlap, U3 is clear (3 components)", async () => {
  const circuit = new Circuit()

  circuit.add(
    <board width="30mm" height="10mm">
      <ChipWithHexOutline name="U1" pcbX={0} />
      <ChipWithHexOutline name="U2" pcbX={3} />
      <ChipWithHexOutline name="U3" pcbX={10} />
    </board>,
  )

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()

  expect(
    circuitJson.filter((el) => el.type === "pcb_courtyard_outline"),
  ).toHaveLength(3)

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
