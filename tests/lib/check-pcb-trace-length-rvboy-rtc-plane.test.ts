import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbTraceLengths } from "../../lib/check-pcb-trace-lengths"
import { createDirectPortToPourLengthMeasurer } from "../../lib/util/get-direct-port-to-pour-length"

test("RVboy C_RTC_OUT stops at the ground plane before the route continues to another pad", async () => {
  const circuit = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL("../fixtures/rvboy-rtc-ground-branch.json.gz", import.meta.url),
      ),
    ).toString(),
  ) as AnyCircuitElement[]
  const source = circuit.find(
    (e) =>
      e.type === "source_trace" &&
      e.display_name === ".C_RTC_OUT > .pin2 to net.GND",
  )!
  if (source.type !== "source_trace")
    throw new Error("Missing capacitor ground connection")
  const traces = circuit.filter(
    (e): e is PcbTrace =>
      e.type === "pcb_trace" && e.source_trace_id === source.source_trace_id,
  )
  const before = JSON.stringify(circuit)
  expect(traces).toHaveLength(1)
  expect(
    createDirectPortToPourLengthMeasurer(circuit)(source, traces)?.length,
  ).toBeCloseTo(Math.hypot(1.115, 0.125) + 1.6, 6)
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
  ).toBeCloseTo(8.097408, 6)
  const reversed = structuredClone(circuit)
  const reversedTrace = reversed.find(
    (e) => e.type === "pcb_trace" && e.pcb_trace_id === traces[0].pcb_trace_id,
  )!
  if (reversedTrace.type !== "pcb_trace")
    throw new Error("Missing ground route")
  reversedTrace.route.reverse()
  expect(
    checkPcbTraceLengths(reversed).some(
      (e) => e.source_trace_id === source.source_trace_id,
    ),
  ).toBe(false)
  const tightLimit = structuredClone(circuit)
  const tightSource = tightLimit.find(
    (e) =>
      e.type === "source_trace" && e.source_trace_id === source.source_trace_id,
  )!
  if (tightSource.type !== "source_trace")
    throw new Error("Missing source trace")
  tightSource.max_length = 2.7
  const violation = checkPcbTraceLengths(tightLimit).find(
    (e) => e.source_trace_id === source.source_trace_id,
  )!
  expect(violation.actual_trace_length).toBeCloseTo(
    Math.hypot(1.115, 0.125) + 1.6,
    6,
  )
  expect(violation.maximum_trace_length).toBe(2.7)
  expect(violation.pcb_trace_id).toBe(traces[0].pcb_trace_id)
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
      viewport: { minX: -13.3, maxX: -8.5, minY: 10.8, maxY: 14.4 },
    })
    const escaped = message
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
    const scale = 1000 / (13.3 - 8.5)
    const screen = (point: { x: number; y: number }) => ({
      x: 500 + (point.x + 10.9) * scale,
      y: 550 - (point.y - 12.6) * scale,
    })
    const route = traces[0].route
    const firstVia = route.findIndex((point) => point.route_type === "via")
    const highlight = route
      .slice(1)
      .map((point, index) => {
        const previous = route[index]
        if (point.route_type !== "wire" || previous.route_type !== "wire")
          return ""
        if (point.layer !== previous.layer) return ""
        const a = screen(previous),
          b = screen(point)
        const measured = errors.length || index < firstVia
        return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${errors.length ? "#ffcc00" : measured ? "#88ff88" : "#aaa"}" stroke-width="6" ${measured ? "" : 'stroke-dasharray="10 7"'}/>`
      })
      .join("")
    const contactPoint = route[firstVia]
    if (contactPoint.route_type !== "via") throw new Error("Missing plane via")
    const contact = screen(contactPoint)
    return svg
      .replace(
        "<style></style>",
        '<style>[data-type^="pcb_silkscreen"] {opacity: 0.12}</style>',
      )
      .replace(
        "</svg>",
        `${highlight}
      <circle cx="${contact.x}" cy="${contact.y}" r="55" fill="none" stroke="${errors.length ? "#ffcc00" : "#88ff88"}" stroke-width="4"/>
      <rect x="40" y="750" width="440" height="46" fill="#111"/>
      <text x="50" y="781" font-family="sans-serif" font-size="24" fill="white">C_RTC_OUT to GND plane via</text>
      <rect x="0" y="0" width="1000" height="110" fill="#111"/>
      <text x="500" y="40" text-anchor="middle" font-family="sans-serif" font-size="28" fill="${errors.length ? "#ffcc00" : "#88ff88"}">${escaped}</text>
      <text x="500" y="82" text-anchor="middle" font-family="sans-serif" font-size="24" fill="white">C_RTC_OUT GND: 1.122 mm to plane via; unchanged copper</text></svg>`,
      )
  }
  await expect(
    render("Before: 8.10 mm > 5 mm (route beyond plane counted)", [
      previousError,
    ]),
  ).toMatchSvgSnapshot(import.meta.path, "rvboy-rtc-plane-length-before")
  await expect(
    render("After: 2.722 mm including via < 5 mm", []),
  ).toMatchSvgSnapshot(import.meta.path, "rvboy-rtc-plane-length-after")
})
