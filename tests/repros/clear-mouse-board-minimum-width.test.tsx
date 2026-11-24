import { beforeAll, expect, test } from "bun:test"
import { runAllRoutingChecks } from "lib/run-all-checks"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
// Reduced from Clear Mouse's R_PAIR -> ESC_PAIR route. Board-world XY in mm.
// The net-connected source trace has no explicit min_trace_thickness; the board
// specifies 0.15mm. Preserve the captured terminal widths and the manual MCU stub.
const circuitJson: AnyCircuitElement[] = [
  {
    type: "pcb_board",
    pcb_board_id: "board",
    center: { x: 0.5, y: 0 },
    width: 5,
    height: 2,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
    min_trace_width: 0.15,
  },
  {
    type: "source_trace",
    source_trace_id: "pair",
    connected_source_port_ids: ["resistor_pin2", "via_top"],
    connected_source_net_ids: ["PAIR"],
    display_name: "R_PAIR to ESC_PAIR",
  },
  {
    type: "pcb_port",
    pcb_port_id: "start",
    source_port_id: "resistor_pin2",
    pcb_component_id: "resistor",
    x: 2,
    y: 0,
    layers: ["top"],
  },
  {
    type: "pcb_port",
    pcb_port_id: "end",
    source_port_id: "via_top",
    pcb_component_id: "via",
    x: 0,
    y: 0,
    layers: ["top"],
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad",
    pcb_component_id: "resistor",
    pcb_port_id: "start",
    shape: "rect",
    x: 2,
    y: 0,
    width: 0.4,
    height: 0.4,
    layer: "top",
  },
  {
    type: "pcb_via",
    pcb_via_id: "escape",
    x: 0,
    y: 0,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
    pcb_port_ids: ["end"],
    source_net_id: "PAIR",
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "route",
    source_trace_id: "pair",
    route: [
      {
        route_type: "wire",
        x: 2,
        y: 0,
        width: 0.15,
        layer: "top",
        start_pcb_port_id: "start",
      },
      ...[
        [0.75, 0.1438980579413864],
        [0.65625, 0.1377961158827728],
        [0.5625, 0.1316941738241592],
        [0.46875, 0.12559223176554563],
        [0.375, 0.11949028970693203],
        [0.28125, 0.11338834764831844],
        [0.1875, 0.10728640558970484],
        [0.09375, 0.10606601717798213],
        [0.075, 0.10606601717798213],
      ].map(([x, width]) => ({
        route_type: "wire" as const,
        x,
        y: 0,
        width,
        layer: "top" as const,
      })),
      {
        route_type: "wire",
        x: 0,
        y: 0,
        width: 0.15,
        layer: "top",
        end_pcb_port_id: "end",
      },
    ],
  },
]
circuitJson.push(
  {
    type: "source_trace",
    source_trace_id: "manual",
    connected_source_port_ids: ["mcu_pin", "via_top"],
    connected_source_net_ids: ["PAIR"],
    display_name: "MCU PAIR pin to escape via",
  },
  {
    type: "pcb_port",
    pcb_port_id: "mcu_port",
    source_port_id: "mcu_pin",
    pcb_component_id: "mcu",
    x: -1.100047,
    y: -0.299937,
    layers: ["top"],
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "mcu_pad",
    pcb_component_id: "mcu",
    pcb_port_id: "mcu_port",
    shape: "rect",
    x: -1.100047,
    y: -0.299937,
    width: 0.3,
    height: 0.3,
    layer: "top",
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "stub",
    source_trace_id: "manual",
    route: [
      {
        route_type: "wire",
        x: -1.100047,
        y: -0.299937,
        width: 0.15,
        layer: "top",
        start_pcb_port_id: "mcu_port",
      },
      {
        route_type: "wire",
        x: 0,
        y: 0,
        width: 0.15,
        layer: "top",
        end_pcb_port_id: "end",
      },
    ],
  },
)

let diagnostics: Awaited<ReturnType<typeof runAllRoutingChecks>> = []
beforeAll(async () => {
  const control = structuredClone(circuitJson)
  for (const record of control) {
    if (record.type !== "pcb_trace") continue
    for (const point of record.route)
      if (point.route_type === "wire") point.width = 0.15
  }
  expect(await runAllRoutingChecks(control)).toHaveLength(0)
  diagnostics = await runAllRoutingChecks(circuitJson)
  const trace = circuitJson.find(
    (record) => record.type === "pcb_trace" && record.pcb_trace_id === "route",
  )!
  if (trace.type !== "pcb_trace") throw new Error("Missing PAIR route")
  const exposedMinimum = Math.min(
    ...trace.route.flatMap((point) =>
      point.route_type === "wire" && point.x > 0.3 ? [point.width] : [],
    ),
  )
  expect(exposedMinimum).toBeLessThan(0.15)
  const svg = convertCircuitJsonToPcbSvg(circuitJson, {
    width: 1000,
    height: 500,
    shouldDrawErrors: true,
  })
  const caption = `<text x="20" y="30" fill="white" font-family="sans-serif" font-size="18">PAIR: board minimum 0.150mm; exposed copper ${exposedMinimum.toFixed(3)}mm</text><text x="20" y="58" fill="#ffd166" font-family="sans-serif" font-size="18">runAllRoutingChecks: ${diagnostics.length} diagnostics</text><text x="20" y="480" fill="white" font-family="sans-serif" font-size="16">MCU pad (left) — ESC_PAIR via (center) — R_PAIR pad (right). Narrow copper is immediately right of the via.</text>`
  // Keep snapshot verification outside the expected-failure assertion.
  await expect(svg.replace("</svg>", `${caption}</svg>`)).toMatchSvgSnapshot(
    import.meta.path,
  )
})

test.failing(
  "routing checks report PAIR copper below the board minimum width",
  () => {
    expect(
      diagnostics.some((diagnostic) =>
        /width|thickness/i.test(diagnostic.message),
      ),
    ).toBe(true)
  },
)
