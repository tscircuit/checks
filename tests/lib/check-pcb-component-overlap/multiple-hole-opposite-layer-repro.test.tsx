import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

test.failing(
  "checks every hole in an opposite-layer component against top courtyards",
  async () => {
    const circuit = new Circuit({
      platform: { placementDrcChecksDisabled: true },
    })
    circuit.add(
      <board width="14mm" height="8mm" routingDisabled>
        <chip
          name="J1"
          layer="bottom"
          footprint={
            <footprint>
              <hole pcbX="-3mm" pcbY="0mm" diameter="1.2mm" />
              <hole pcbX="3mm" pcbY="0mm" diameter="1.2mm" />
            </footprint>
          }
        />
        <chip
          name="U1"
          layer="top"
          pcbX="-3mm"
          footprint={
            <footprint>
              <courtyardrect width="2mm" height="2mm" />
            </footprint>
          }
        />
      </board>,
    )

    await circuit.renderUntilSettled()
    const circuitJson = circuit.getCircuitJson()
    const errors = checkPcbComponentOverlap(circuitJson)

    expect(
      convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
        shouldDrawErrors: true,
        showCourtyards: true,
      }),
    ).toMatchSvgSnapshot(import.meta.path)

    expect(errors).toContainEqual(
      expect.objectContaining({
        type: "pcb_footprint_overlap_error",
        pcb_hole_ids: ["pcb_hole_1"],
      }),
    )
  },
)
