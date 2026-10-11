import { expect, test } from "bun:test"
import {
  convertCircuitJsonToFlattenJs,
  renderFlattenJsToSvg,
} from "@tscircuit/circuit-json-to-flattenjs"
import { checkSourceTracesMatchPcbTraceThickness as check } from "lib/check-source-traces-match-pcb-trace-thickness"
import { runAllRoutingChecks } from "lib/run-all-checks"
import { sourceAttributionFixture } from "../fixtures/trace-width-source-attribution"
import { traceWidthFixture } from "../fixtures/trace-width"

test.failing(
  "compliant owned routes ignore narrower branches on the same net",
  async () => {
    const results = await Promise.all(
      [0.5, 3].map(async (required) => {
        const circuit = sourceAttributionFixture(required)
        const warnings = (await runAllRoutingChecks(circuit)).filter(
          (e) => e.type === "pcb_trace_warning",
        )
        expect(warnings).toEqual(check(circuit))
        return { required, circuit, warnings }
      }),
    )
    const failed = results.some(({ warnings }) => warnings.length)
    const panels = results
      .map(({ required, circuit, warnings }, index) => {
        const geometry = convertCircuitJsonToFlattenJs(circuit, {
          roles: ["copper"],
          strict: true,
        })
        const copper = renderFlattenJsToSvg(geometry, {
          width: 400,
          height: 400,
          background: "white",
          viewport: { minX: -3, maxX: 13, minY: -3, maxY: 13 },
        })
        // Mark actual checker coordinates, in the renderer's board-space viewBox.
        const markers = warnings
          .map(
            ({ center }) =>
              `<circle cx="${center!.x}" cy="${-center!.y!}" r="0.5" fill="none" stroke="#c62828" stroke-width="0.1"/>`,
          )
          .join("")
        const title = required === 0.5 ? "USB_GND_1" : "TEC_INPUT_HOT_LOOP"
        return `<g transform="translate(${50 + index * 450} 115)">
      <text x="200" y="0" text-anchor="middle">${title}</text>
      <g transform="translate(0 15)">${copper.replace("</svg>", `${markers}</svg>`)}</g>
      <text x="200" y="435" text-anchor="middle">Owned: ${required} mm / required: ${required} mm; branch: 0.2 mm</text>
      <text x="200" y="462" text-anchor="middle">${warnings.length ? "False width warning on the branch" : "No width warning"}</text>
    </g>`
      })
      .join("")
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="950" height="610" viewBox="0 0 950 610">
    <rect width="950" height="610" fill="white"/>
    <g font-family="Arial, sans-serif" font-size="16" fill="#222">
      <text x="475" y="38" text-anchor="middle" font-size="24">${failed ? "FAIL: unrelated branches trigger width warnings" : "PASS: source ownership keeps width checks on each route"}</text>
      <text x="475" y="68" text-anchor="middle">Two compliant routes share nets with narrower, explicitly owned branches.</text>
      ${panels}
    </g>
  </svg>`
    // Capture observed failures separately; only compliant output is a baseline.
    if (process.env.TRACE_WIDTH_EVIDENCE) {
      await Bun.write(`${process.env.TRACE_WIDTH_EVIDENCE}.svg`, svg)
      await Bun.write(
        `${process.env.TRACE_WIDTH_EVIDENCE}.json`,
        JSON.stringify(
          results.map(({ required, warnings }) => ({ required, warnings })),
          null,
          2,
        ),
      )
    }
    for (const { warnings } of results) expect(warnings).toEqual([])
    await expect(svg).toMatchSvgSnapshot(import.meta.path)
  },
)

test("an actually undersized owned USB route still warns on its own copper", () => {
  const warnings = check(sourceAttributionFixture(0.5, 0.2))
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    source_trace_id: "source_trace_0",
    pcb_trace_id: "pcb_trace_0",
  })
  expect(warnings[0].message).toContain("requested: 0.5mm, actual: 0.2mm")
})

test("legacy unowned copper still uses connectivity for width warnings", () => {
  const circuit = traceWidthFixture([0.2, 0.2])
  delete circuit.find((e) => e.type === "pcb_trace")!.source_trace_id
  expect(check(circuit)).toHaveLength(1)
})
