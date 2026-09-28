import { expect, test } from "bun:test"
import {
  convertCircuitJsonToFlattenJs,
  renderFlattenJsToSvg,
} from "@tscircuit/circuit-json-to-flattenjs"
import { runAllRoutingChecks } from "lib/run-all-checks"
import { traceWidthFixture } from "../fixtures/trace-width"

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

test("routing width warnings highlight deficient copper beside a compliant control", async () => {
  const cases = [
    {
      title: "A. Narrow segment: warning was previously missed",
      widths: [1, 0.5, 0.1],
      explanation:
        "1.0 mm for 10 mm, then 0.5 mm for 10 mm; terminal width metadata = 0.1 mm",
      expectedCenter: { x: 15, y: 0 },
    },
    {
      title: "B. Widened route: no width warning",
      widths: [1, 1, 0.1],
      explanation:
        "1.0 mm along the entire route; terminal width metadata = 0.1 mm (no outgoing copper)",
      expectedCenter: undefined,
    },
    {
      title: "C. Interpolated taper: marker inside the undersized portion",
      widths: [1.5, 0.5],
      mode: "interpolated" as const,
      explanation:
        "1.5 mm to 0.5 mm over 10 mm; last 5 mm is below the 1.0 mm requirement",
      expectedCenter: { x: 7.5, y: 0 },
    },
  ]
  const panels: string[] = []
  for (const [index, scenario] of cases.entries()) {
    const circuit = traceWidthFixture(scenario.widths, scenario.mode)
    // Exercise the public routing pipeline, not just the width helper.
    const warnings = (await runAllRoutingChecks(circuit)).filter(
      (result) => result.type === "pcb_trace_warning",
    )
    expect(warnings).toHaveLength(scenario.expectedCenter ? 1 : 0)
    if (scenario.expectedCenter) {
      expect(warnings[0].center).toEqual(scenario.expectedCenter)
    }
    // Use the copper geometry converter because the pinned circuit-to-svg
    // release renders interpolated tapers as constant-width traces.
    const geometry = convertCircuitJsonToFlattenJs(circuit, {
      layers: ["top"],
      roles: ["copper"],
      strict: true,
    })
    expect(geometry.warnings).toEqual([])
    const pcbSvg = renderFlattenJsToSvg(geometry, {
      padding: 0,
      background: "#000000",
      colors: { copper: "#c83232" },
      width: 1000,
      height: 120,
      viewport: { minX: -2, maxX: 22, minY: -1.44, maxY: 1.44 },
    })
    // The pinned SVG renderer does not draw pcb_trace_warning. Draw its actual
    // returned center as a crosshair, using the same board-space viewport.
    // Coordinates are board-world mm: +X right, +Y up; SVG Y points down.
    const markers = warnings.map(({ center }) => {
      const x = ((center!.x! + 2) / 24) * 1000
      const y = ((1.44 - center!.y!) / 2.88) * 120
      return `<g transform="translate(${x} ${y})" stroke="#ffd166" fill="none" stroke-width="2"><circle r="14"/><path d="M-21 0H21M0-21V21"/></g>`
    })
    const copper = pcbSvg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")
    const annotatedPcb = `<g transform="translate(${1000 / 12} 60) scale(${1000 / 24})">${copper}</g>${markers.join("")}`
    const message =
      warnings[0]?.message ??
      "No width warning: all nonzero wire segments meet the 1 mm requirement."
    panels.push(`<g transform="translate(50 ${115 + index * 245})">
      <text x="0" y="0" font-size="22" fill="white">${escapeXml(scenario.title)}</text>
      <text x="0" y="28" font-size="15" fill="#c8d2df">${escapeXml(scenario.explanation)}</text>
      <g transform="translate(0 42)">${annotatedPcb}</g>
      <text x="0" y="188" font-size="15" fill="${warnings.length ? "#ffd166" : "#86efac"}">${escapeXml(message)}</text>
    </g>`)
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="850" viewBox="0 0 1100 850">
    <rect width="1100" height="850" fill="#101923"/>
    <g font-family="Arial, sans-serif">
      <text x="50" y="42" font-size="27" fill="white">Trace-width DRC: required width = 1 mm</text>
      <text x="50" y="73" font-size="16" fill="#c8d2df">Actual PCB copper at a shared scale. Yellow crosshair = warning.center from runAllRoutingChecks.</text>
      ${panels.join("")}
      <text x="50" y="826" font-size="15" fill="#c8d2df">Explicit width checks only; current-capacity estimation and net-width checks are separate follow-up work.</text>
    </g>
  </svg>`
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
