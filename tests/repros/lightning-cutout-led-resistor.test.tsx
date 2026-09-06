import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { runAllPlacementChecks } from "lib/run-all-checks"
import { containsCircuitJsonId } from "lib/util/get-readable-names"

const LightningCutoutResistorRepro = () => (
  <board width="40mm" height="30mm" layers={2}>
    <cutout
      shape="polygon"
      pcbX={4}
      pcbY={0}
      points={[
        { x: -2, y: -6 },
        { x: 3, y: -6 },
        { x: 0, y: -1 },
        { x: 3, y: -1 },
        { x: -4, y: 7 },
        { x: -1, y: 1 },
        { x: -4, y: 1 },
      ]}
    />
    <resistor
      name="R1"
      resistance="330ohm"
      footprint="1206"
      pcbX={4}
      pcbY={0}
      layer="bottom"
    />
  </board>
)

test("lightning cutout with a resistor directly on the cutout", async () => {
  const circuit = new Circuit()

  circuit.add(<LightningCutoutResistorRepro />)

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const placementErrors = await runAllPlacementChecks(circuitJson)

  expect(placementErrors.length).toBeGreaterThan(0)
  expect(placementErrors.map((error) => error.type)).toContain(
    "pcb_placement_error",
  )
  expect(placementErrors[0].message).toBe(
    "Component R1 overlaps with polygon cutout at (3.50mm, 0.50mm)",
  )
  expect(containsCircuitJsonId(placementErrors[0].message)).toBe(false)
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...placementErrors], {
      shouldDrawErrors: true,
      showCourtyards: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
