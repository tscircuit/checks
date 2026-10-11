import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import {
  convertCircuitJsonToFlattenJs,
  renderFlattenJsToSvg,
} from "@tscircuit/circuit-json-to-flattenjs"
import { checkSourceTracesMatchPcbTraceThickness as check } from "lib/check-source-traces-match-pcb-trace-thickness"
import { runAllRoutingChecks } from "lib/run-all-checks"
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"

test("owned routes ignore narrower same-net branches", async () => {
  async function fixture(required: number, actual = required) {
    const circuit = new Circuit({
      platform: { routingDrcChecksDisabled: true },
    })
    circuit.add(
      <board width={30} height={30} schematicDisabled routeRemaining={false}>
        {(
          [
            ["A", 0, 0],
            ["B", 10, 0],
            ["C", 10, 10],
          ] as const
        ).map(([name, pcbX, pcbY]) => (
          <testpoint
            key={name}
            name={name}
            pcbX={pcbX}
            pcbY={pcbY}
            footprintVariant="pad"
            padDiameter={0.5}
          />
        ))}
        <trace
          name={required === 0.5 ? "USB_GND_1" : "TEC_INPUT_HOT_LOOP"}
          from="A.1"
          to="B.1"
          thickness={required}
          pcbPath={["A.1", "B.1"]}
        />
        <trace
          name={
            required === 0.5 ? "INPUT_DVDT_LOCAL_GROUND" : "TEC_CONTROLLER_VIN"
          }
          from="B.1"
          to="C.1"
          thickness={0.2}
          pcbPath={["B.1", "C.1"]}
        />
      </board>,
    )
    await circuit.renderUntilSettled()
    const json = normalizeFixtureSourcePorts(circuit.getCircuitJson())
    expect(json.filter((e) => e.type === "pcb_trace")).toHaveLength(2)
    expect(json.filter((e) => e.type === "pcb_trace_error")).toEqual([])
    const source = json.find(
      (e) => e.type === "source_trace" && e.min_trace_thickness === required,
    )!
    if (source.type !== "source_trace") throw new Error("Missing source trace")
    const owned = json.find(
      (e) =>
        e.type === "pcb_trace" && e.source_trace_id === source.source_trace_id,
    )!
    if (owned.type !== "pcb_trace") throw new Error("Missing owned route")
    // Fault controls change only rendered copper, preserving the JSX requirement.
    if (actual !== required)
      for (const point of owned.route)
        if (point.route_type === "wire") point.width = actual
    return { circuit: json, source, owned }
  }

  const control = await fixture(0.5, 0.2)
  const ownedWarnings = check(control.circuit)
  expect(ownedWarnings).toHaveLength(1)
  expect(ownedWarnings[0]).toMatchObject({
    source_trace_id: control.source.source_trace_id,
    pcb_trace_id: control.owned.pcb_trace_id,
  })
  expect(ownedWarnings[0].message).toContain("requested: 0.5mm, actual: 0.2mm")
  for (const element of control.circuit)
    if (element.type === "pcb_trace") delete element.source_trace_id
  expect(check(control.circuit)).toHaveLength(1)
  const results = await Promise.all(
    [0.5, 3].map(async (required) => {
      const { circuit } = await fixture(required)
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
  if (process.env.TRACE_WIDTH_EVIDENCE)
    await Bun.write(process.env.TRACE_WIDTH_EVIDENCE, svg)
  for (const { warnings } of results) expect(warnings).toEqual([])
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
