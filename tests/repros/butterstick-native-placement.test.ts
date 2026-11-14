import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

test("ButterStick native full board reports its same-net annulus contact", () => {
  // All 350 native components and 349 nets; only existing copper was removed.
  // https://github.com/butterstick-fpga/butterstick-hardware/blob/0694ddfa9824a07f0c6c6981186e45f80187659c/hardware/ButterStick_r1.0/ButterStick.kicad_pcb
  const circuit: AnyCircuitElement[] = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL("../assets/butterstick-placement.json.gz", import.meta.url),
      ),
    ).toString(),
  )
  expect(
    circuit.filter((element) => element.type === "pcb_component"),
  ).toHaveLength(350)
  expect(
    circuit.filter((element) => element.type === "source_net"),
  ).toHaveLength(349)
  const errors = checkPcbComponentOverlap(circuit)
  expect(errors).toHaveLength(1)
  expect(
    convertCircuitJsonToPcbSvg([...circuit, ...errors], {
      backgroundColor: "white",
      colorOverrides: {
        substrate: "#ffffff",
        copper: { top: "#dc2626", bottom: "#2563eb" },
      },
      width: 1200,
      height: 900,
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
      shouldDrawRatsNest: false,
      includeVersion: false,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
