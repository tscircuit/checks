import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbComponentOwnFootprintPadOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOwnFootprintPadOverlap"
import { Circuit } from "tscircuit"

test("overlapping pads in the same pcb_component should show an error", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width="12mm" height="30mm">
      <chip
        name="USB1"
        footprint="dip4_w0.1in"
        manufacturerPartNumber="USB-C-BREAKOUT"
        pinLabels={{
          pin1: "GND",
          pin2: "VBUS",
          pin3: "DP",
          pin4: "DM",
        }}
      />
    </board>,
  )

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()

  const errors = checkPcbComponentOwnFootprintPadOverlap(circuitJson as any)
  expect(errors).toMatchInlineSnapshot(`
    [
      {
        "error_type": "pcb_footprint_overlap_error",
        "message": "through-hole pad USB1.GND at (-0.05mm, 1.27mm) overlaps through-hole pad USB1.DM at (0.05mm, 1.27mm) in component; adjust footprint pad positions/sizes so copper pads do not intersect; you can also use the footprint string to adjust the pad positions/sizes",
        "pcb_error_id": "pcb_component_self_overlap_pcb_component_0_pcb_plated_hole_0_pcb_plated_hole_3",
        "pcb_plated_hole_ids": [
          "pcb_plated_hole_0",
          "pcb_plated_hole_3",
        ],
        "type": "pcb_footprint_overlap_error",
      },
    ]
  `)
  expect(errors).toHaveLength(1)

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
