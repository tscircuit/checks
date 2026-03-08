import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkViaToPadSpacing } from "lib/check-via-to-pad-spacing"

test("pcb snapshot showing via too close to pad", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width="12mm" height="8mm">
      <chip
        name="U1"
        footprint="soic8"
        pcbX={-2}
        pcbY={0}
      />
      <chip
        name="U2"
        footprint="soic8"
        pcbX={4}
        pcbY={0}
      />
      <trace from=".U1 > .pin1" to=".U2 > .pin5" />
    </board>,
  )

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson() as any[]

  // Find a pad from U1 to place a via too close to it
  const pad = circuitJson.find(
    (el: any) => el.type === "pcb_smtpad" && el.pcb_component_id,
  )

  if (pad) {
    // Place a via 0.2mm from the pad center (well within clearance)
    circuitJson.push({
      type: "pcb_via",
      pcb_via_id: "test_via_1",
      x: pad.x + 0.3,
      y: pad.y,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      layers: ["top", "bottom"],
    })
  }

  const errors = checkViaToPadSpacing(circuitJson)
  expect(errors.length).toBeGreaterThan(0)
  expect(errors[0].message).toContain("too close to pad")

  const pcbSvg = convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
    shouldDrawErrors: true,
  })

  await expect(pcbSvg).toMatchSvgSnapshot(import.meta.path)
})
