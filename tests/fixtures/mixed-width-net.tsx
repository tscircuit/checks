import { Circuit } from "@tscircuit/core"
import type { AnyCircuitElement, PcbTrace, PcbTraceWarning } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"

export async function mixedWidthNetFixture(routedThickTraceWidth = 0.8) {
  const circuit = new Circuit({ platform: { routingDrcChecksDisabled: true } })
  circuit.add(
    <board width={20} height={10} routingDisabled schematicDisabled>
      <resistor name="R1" resistance="1k" footprint="0603" pcbX={-5} />
      <resistor name="R2" resistance="1k" footprint="0603" pcbX={0} />
      <resistor name="R3" resistance="1k" footprint="0603" pcbX={5} />
      <trace from=".R1 > .pin2" to=".R2 > .pin1" thickness={0.8} pcbPath={[]} />
      <trace
        from=".R2 > .pin1"
        to=".R3 > .pin1"
        thickness={0.2}
        pcbPath={[
          { x: -0.8, y: 2 },
          { x: 4.2, y: 2 },
        ]}
      />
      <pcbnotetext
        text={`R1 to R2: requested 0.8 mm, routed ${routedThickTraceWidth} mm`}
        pcbY={-2.5}
        fontSize={0.45}
      />
      <pcbnotetext
        text="R2 to R3: requested and routed 0.2 mm (same net)"
        pcbY={-3.5}
        fontSize={0.4}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const sourceTrace = circuitJson
    .filter((element) => element.type === "source_trace")
    .find((sourceTrace) => sourceTrace.min_trace_thickness === 0.8)!
  const pcbTrace = circuitJson
    .filter((element) => element.type === "pcb_trace")
    .find(
      (pcbTrace) => pcbTrace.source_trace_id === sourceTrace.source_trace_id,
    )!
  // The control deliberately narrows emitted copper without changing its request.
  if (pcbTrace.type === "pcb_trace" && routedThickTraceWidth !== 0.8) {
    for (const point of pcbTrace.route) {
      if (point.route_type === "wire") point.width = routedThickTraceWidth
    }
  }
  return { circuitJson, sourceTrace, pcbTrace }
}

export async function mixedWidthNetWithNeckdownsFixture(
  mode: PcbTrace["route_thickness_mode"],
) {
  const fixture = await mixedWidthNetFixture()
  const { pcbTrace } = fixture
  const start = pcbTrace.route[0]
  const end = pcbTrace.route.at(-1)!
  if (start.route_type !== "wire" || end.route_type !== "wire") {
    throw new Error("Expected a wire between the connected resistor pads")
  }
  pcbTrace.route_thickness_mode = mode
  // Each pad extends 0.4 mm along the route. A 1 mm neck-down therefore
  // uses only 0.6 mm of the default 0.8 mm escape allowance beyond its edge.
  pcbTrace.route = [
    { ...start, width: 0.2 },
    {
      route_type: "wire",
      x: start.x + 1,
      y: start.y,
      width: 0.8,
      layer: start.layer,
    },
    {
      route_type: "wire",
      x: end.x - 1,
      y: end.y,
      width: mode === "interpolated" ? 0.8 : 0.2,
      layer: end.layer,
    },
    { ...end, width: 0.2 },
  ]
  return fixture
}

export function renderMixedWidthNetWarnings(
  circuitJson: AnyCircuitElement[],
  warnings: PcbTraceWarning[],
) {
  const width = 1000
  const height = 650
  const viewport = { minX: -11, maxX: 11, minY: -6, maxY: 6 }
  const scale = Math.min(width / 22, height / 12)
  const svg = convertCircuitJsonToPcbSvg(circuitJson, {
    width,
    height,
    viewport,
    shouldDrawErrors: true,
  })
  // The pinned renderer omits pcb_trace_warning. As in render-clearance-locations,
  // map emitted board-world points (mm, +X right, +Y up) to SVG (+Y down).
  const markers = warnings.map(({ center, message }, warningIndex) => {
    const x = width / 2 + center!.x! * scale
    const y = height / 2 - center!.y! * scale
    const text = message
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
    return `<g stroke="#ffd166" fill="none" stroke-width="2" transform="translate(${x} ${y})"><circle r="10"/><path d="M-15 0H15M0-15V15"/></g><text x="20" y="${25 + 25 * warningIndex}" fill="#ffd166" font-family="sans-serif" font-size="14">${text}</text>`
  })
  const status = warnings.length
    ? markers.join("")
    : '<text x="20" y="25" fill="#86efac" font-family="sans-serif" font-size="16">Each trace meets its own requested width; no warning.</text>'
  return svg.replace("</svg>", `${status}</svg>`)
}
