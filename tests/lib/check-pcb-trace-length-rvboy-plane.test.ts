import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbTraceLengths } from "../../lib/check-pcb-trace-lengths"
import { createDirectPortToPourLengthMeasurer } from "../../lib/util/get-direct-port-to-pour-length"

test("RVboy C_SOC_54 measures its direct ground drop instead of an unrelated ground branch", async () => {
  const circuit = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL("../fixtures/rvboy-port-to-plane.json.gz", import.meta.url),
      ),
    ).toString(),
  ) as AnyCircuitElement[]
  const source = circuit.find(
    (e) =>
      e.type === "source_trace" &&
      e.display_name === ".C_SOC_54 > .pin2 to net.GND",
  )!
  if (source.type !== "source_trace")
    throw new Error("Missing capacitor ground connection")
  const traces = circuit.filter(
    (e): e is PcbTrace =>
      e.type === "pcb_trace" && e.source_trace_id === source.source_trace_id,
  )
  const before = JSON.stringify(circuit)
  expect(traces).toHaveLength(2)
  expect(
    createDirectPortToPourLengthMeasurer(circuit)(source, traces)?.length,
  ).toBeCloseTo(2.245, 6)
  expect(
    checkPcbTraceLengths(circuit).some(
      (e) => e.source_trace_id === source.source_trace_id,
    ),
  ).toBe(false)
  expect(JSON.stringify(circuit)).toBe(before)
  const withoutPlane = circuit.filter((e) => e.type !== "pcb_copper_pour")
  expect(
    checkPcbTraceLengths(withoutPlane).find(
      (e) => e.source_trace_id === source.source_trace_id,
    )?.actual_trace_length,
  ).toBeGreaterThan(13.5)
  const previousError = circuit.find(
    (e) =>
      e.type === "pcb_trace_too_long_error" &&
      e.source_trace_id === source.source_trace_id,
  )!
  expect(previousError).toBeDefined()
  const geometry = circuit.filter((e) => !e.type.endsWith("_error"))
  // Full captured input, cropped only in the renderer. The checker changes no
  // copper; the before/after annotations show the length diagnostic correction.
  const render = (message: string, errors: AnyCircuitElement[]) => {
    const svg = convertCircuitJsonToPcbSvg([...geometry, ...errors], {
      width: 1000,
      height: 1100,
      layer: "top",
      hiddenLayerOpacity: 0,
      shouldDrawErrors: true,
      viewport: { minX: -0.5, maxX: 5.5, minY: 0.5, maxY: 7.6 },
    })
    const escaped = message
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
    return svg.replace(
      "</svg>",
      `<rect x="0" y="0" width="1000" height="110" fill="#111"/>
      <text x="500" y="40" text-anchor="middle" font-family="sans-serif" font-size="28" fill="${errors.length ? "#ffcc00" : "#88ff88"}">${escaped}</text>
      <text x="500" y="82" text-anchor="middle" font-family="sans-serif" font-size="24" fill="white">C_SOC_54 GND: 0.645 mm to plane via; unchanged copper</text></svg>`,
    )
  }
  await expect(
    render("Before: 13.51 mm > 5 mm (unrelated branch counted)", [
      previousError,
    ]),
  ).toMatchSvgSnapshot(import.meta.path, "rvboy-plane-length-before")
  await expect(
    render("After: 2.245 mm including via < 5 mm", []),
  ).toMatchSvgSnapshot(import.meta.path, "rvboy-plane-length-after")
})
