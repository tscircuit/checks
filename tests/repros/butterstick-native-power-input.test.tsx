import { expect, test } from "bun:test"
import { RootCircuit } from "tscircuit"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"
import { ButterStickPowerInput } from "../fixtures/butterstick-power-input"

test("ButterStick C165 touches U18's same-net annulus without touching its drill", async () => {
  const circuit = new RootCircuit()
  circuit.add(<ButterStickPowerInput />)
  await circuit.renderUntilSettled()
  const elements = circuit
    .getCircuitJson()
    .filter((element) => element.type !== "pcb_footprint_overlap_error")
  const errors = checkPcbComponentOverlap(elements)
  expect(errors).toHaveLength(1)
  expect(
    convertCircuitJsonToPcbSvg([...elements, ...errors], {
      backgroundColor: "white",
      colorOverrides: {
        substrate: "#ffffff",
        copper: { top: "#dc2626", bottom: "#2563eb" },
      },
      width: 1000,
      height: 800,
      viewport: { minX: 12.5, maxX: 23, minY: -9, maxY: -1 },
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
      shouldDrawRatsNest: false,
      includeVersion: false,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
