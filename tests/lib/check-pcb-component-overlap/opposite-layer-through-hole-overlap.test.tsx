import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

test("still reports through-hole copper collisions across component layers", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board width="10mm" height="10mm" routingDisabled>
      <chip
        name="J1"
        layer="bottom"
        pcbX={0}
        pcbY={0}
        pinLabels={{ 1: ["A"] }}
        footprint={
          <footprint>
            <platedhole
              portHints={["pin1"]}
              outerDiameter="1.6mm"
              holeDiameter="0.8mm"
              shape="circle"
            />
          </footprint>
        }
      />
      <chip
        name="U1"
        layer="top"
        pcbX={0}
        pcbY={0}
        pinLabels={{ 1: ["A"] }}
        footprint={
          <footprint>
            <smtpad
              portHints={["pin1"]}
              width="1.2mm"
              height="1.2mm"
              shape="rect"
            />
          </footprint>
        }
      />
    </board>,
  )

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const errors = checkPcbComponentOverlap(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_footprint_overlap_error",
    pcb_smtpad_ids: ["pcb_smtpad_0"],
    pcb_plated_hole_ids: ["pcb_plated_hole_0"],
  })
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
