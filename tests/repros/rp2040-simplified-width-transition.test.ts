import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"

test("RP2040 simplified board has no false overlap before a power width transition", async () => {
  const {
    circuitJson: circuit,
    beforeErrors,
  }: { circuitJson: AnyCircuitElement[]; beforeErrors: AnyCircuitElement[] } =
    JSON.parse(
      gunzipSync(
        new Uint8Array(
          readFileSync(
            new URL(
              "../assets/rp2040-simplified-width-transition.json.gz",
              import.meta.url,
            ),
          ),
        ),
      ).toString(),
    )
  expect(
    checkEachPcbTraceNonOverlapping(circuit, { minClearance: 0.1 }),
  ).toEqual([])
  for (const [name, elements] of [
    ["before", [...circuit, ...beforeErrors]],
    ["after", circuit],
  ] as const) {
    const svg = convertCircuitJsonToPcbSvg(elements, {
      width: 1000,
      height: 650,
      backgroundColor: "white",
      layer: "bottom",
      viewport: { minX: 24.7, maxX: 26.6, minY: 27.1, maxY: 28.7 },
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    })
    await expect(svg).toMatchSvgSnapshot(
      import.meta.path,
      `rp2040-simplified-width-transition-${name}`,
    )
  }
})
