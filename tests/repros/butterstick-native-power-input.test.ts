import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

test("ButterStick C165 touches U18's same-net annulus without touching its drill", () => {
  // Zoom the same complete native circuit used by the full-board snapshot.
  const circuit: AnyCircuitElement[] = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL("../assets/butterstick-placement.json.gz", import.meta.url),
      ),
    ).toString(),
  )
  const errors = checkPcbComponentOverlap(circuit)
  expect(errors).toHaveLength(1)
  expect(
    convertCircuitJsonToPcbSvg([...circuit, ...errors], {
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
