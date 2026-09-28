import { expect, test } from "bun:test"
import {
  convertCircuitJsonToFlattenJs,
  renderFlattenJsToSvg,
} from "@tscircuit/circuit-json-to-flattenjs"
import { runAllRoutingChecks } from "lib/run-all-checks"
import {
  shortPadTaper,
  longPadEscape,
  middleBottleneck,
} from "../fixtures/trace-width-pad-escape"

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

test("pad neckdowns are allowed only within a bounded endpoint escape", async () => {
  const cases = [
    {
      title: "A. Short tapers at connected pads: allowed",
      circuit: shortPadTaper(),
      explanation:
        "0.3 mm at pads, widening to 1 mm within 1 mm of each pad edge",
      expectedCenter: undefined,
    },
    {
      title: "B. Long pad escape: warning beyond the allowance",
      circuit: longPadEscape(),
      explanation:
        "0.3 mm runs for 4 mm from each endpoint; only the pad plus 1 mm escape is exempt",
      expectedCenter: { x: 2.625, y: 0 },
    },
    {
      title: "C. Interior bottleneck: warning despite legal pad escapes",
      circuit: middleBottleneck(),
      explanation:
        "Short endpoint neck-downs are allowed; the 4 mm narrow middle section still warns",
      expectedCenter: { x: 10, y: 0 },
    },
  ]
  const panels: string[] = []
  for (const [index, scenario] of cases.entries()) {
    const circuit = scenario.circuit
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
      "No width warning: narrowing is confined to the connected endpoint pad escapes."
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
      <text x="50" y="42" font-size="27" fill="white">Pad neck-downs: 1 mm width, 1 mm escape allowance</text>
      <text x="50" y="73" font-size="16" fill="#c8d2df">Actual PCB copper at a shared scale. Yellow crosshair = warning.center from runAllRoutingChecks.</text>
      ${panels.join("")}
      <text x="50" y="826" font-size="15" fill="#c8d2df">Explicit width checks only; current-capacity estimation and net-width checks are separate follow-up work.</text>
    </g>
  </svg>`
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
