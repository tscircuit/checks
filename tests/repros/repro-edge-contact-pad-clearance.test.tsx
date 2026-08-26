import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkCopperToBoardEdgeClearance } from "lib/check-copper-to-board-edge-clearance"
import { Circuit } from "tscircuit"

// An SMT pad can intentionally reach the PCB outline when it is used as an
// edge contact without triggering a copper-to-board-edge clearance violation.
// biome-ignore format: preserve upstream spacing
test(
  "intentional edge-contact SMT pads should not report board-edge clearance errors",
  async () => {
    const circuit = new Circuit({
      platform: {
        netlistDrcChecksDisabled: true,
        placementDrcChecksDisabled: true,
      },
    })

    circuit.add(
      <board name="EDGE_CONTACT" width="10mm" height="10mm" routingDisabled>
        <jumper
          name="J1"
          allowOffBoard
          pinLabels={{ 1: "EDGE_CONTACT" }}
          pcbX={0}
          pcbY={-1.49}
        >
          <footprint>
            <smtpad
              portHints={["pin1"]}
              shape="rect"
              width="2mm"
              height="7mm"
              layer="top"
              pcbX={0}
              pcbY={0}
            />
          </footprint>
        </jumper>
      </board>,
    )

    await circuit.renderUntilSettled()

    const circuitJson = circuit.getCircuitJson()
    const errors = checkCopperToBoardEdgeClearance(circuitJson)

    expect(
      convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
        shouldDrawErrors: true,
      }),
    ).toMatchSvgSnapshot(import.meta.path)
    expect(errors).toHaveLength(0)
  },
)
