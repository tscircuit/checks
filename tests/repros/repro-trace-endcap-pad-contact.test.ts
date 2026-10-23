import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"

const padWidth = 0.208
const traceWidth = 0.15
const endpointX = -0.15
const padLeft = -padWidth / 2
const centerGap = padLeft - endpointX
const copperOverlap = traceWidth / 2 - centerGap

// Two pads on the same layer, joined by one constant-width trace. Its center
// stops outside U2.IN, but its round endcap overlaps the pad by 0.029 mm.
const trace: PcbTrace = {
  type: "pcb_trace",
  pcb_trace_id: "pcb_trace_signal",
  source_trace_id: "source_trace_signal",
  route: [
    { route_type: "wire", x: -0.8, y: 0, width: traceWidth, layer: "top" },
    { route_type: "wire", x: endpointX, y: 0, width: traceWidth, layer: "top" },
  ],
}

const circuitJson: AnyCircuitElement[] = [
  ...[
    { id: "driver", name: "U1", pin: "OUT", x: -0.8, size: 0.3 },
    { id: "receiver", name: "U2", pin: "IN", x: 0, size: padWidth },
  ].flatMap(({ id, name, pin, x, size }): AnyCircuitElement[] => [
    {
      type: "source_component",
      source_component_id: `source_component_${id}`,
      ftype: "simple_chip",
      name,
    },
    {
      type: "source_port",
      source_port_id: `source_port_${id}`,
      source_component_id: `source_component_${id}`,
      name: pin,
      port_hints: [pin],
    },
    {
      type: "pcb_port",
      pcb_port_id: `pcb_port_${id}`,
      source_port_id: `source_port_${id}`,
      x,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: `pcb_smtpad_${id}`,
      pcb_port_id: `pcb_port_${id}`,
      shape: "rect",
      x,
      y: 0,
      width: size,
      height: size,
      layer: "top",
    },
  ]),
  {
    type: "source_trace",
    source_trace_id: "source_trace_signal",
    connected_source_port_ids: ["source_port_driver", "source_port_receiver"],
    connected_source_net_ids: [],
  },
  trace,
]

const missingConnection = {
  pcb_port_ids: ["pcb_port_receiver"],
  message: "Trace [U1.OUT to U2.IN] is missing a connection to SMD pad U2.IN",
}

test("round endcap touching a pad is connected even when its center is outside", () => {
  expect(centerGap).toBeGreaterThan(0)
  expect(copperOverlap).toBeCloseTo(0.029, 9)
  const errors = checkTracesAreContiguous(circuitJson)
  expect(errors).toEqual([])

  const annotations: AnyCircuitElement[] = [
    ...[
      { text: "U1.OUT", x: -0.8, y: 0.21 },
      { text: "U2.IN", x: 0, y: 0.21 },
      { text: "Endpoint center", x: endpointX, y: -0.21 },
    ].map(
      ({ text, x, y }): AnyCircuitElement => ({
        type: "pcb_note_text",
        pcb_note_text_id: text,
        text,
        anchor_position: { x, y },
        anchor_alignment: "center",
        font: "tscircuit2024",
        font_size: 0.032,
        layer: "top",
        color: "#1e3a8a",
      }),
    ),
    {
      type: "pcb_note_line",
      pcb_note_line_id: "endpoint_pointer",
      x1: endpointX,
      y1: -0.17,
      x2: endpointX,
      y2: 0,
      stroke_width: 0.003,
      layer: "top",
      color: "#1e3a8a",
    },
    {
      type: "pcb_note_line",
      pcb_note_line_id: "endpoint_marker",
      x1: endpointX - 0.009,
      y1: 0,
      x2: endpointX + 0.009,
      y2: 0,
      stroke_width: 0.003,
      layer: "top",
      color: "#1e3a8a",
    },
  ]
  const boardSvg = convertCircuitJsonToPcbSvg(
    [...circuitJson, ...annotations],
    {
      width: 900,
      height: 300,
      viewport: { minX: -1.02, minY: -0.25, maxX: 0.25, maxY: 0.25 },
      backgroundColor: "#ffffff",
      colorOverrides: { copper: { top: "#c46a20" } },
      includeVersion: false,
    },
  )
  const color = errors.length ? "#b91c1c" : "#166534"
  const message =
    errors.map((error) => error.message).join("; ") || "No missing connections."
  const escapedMessage = message
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
  // Render the real copper with circuit-to-svg; only the caption is added here.
  // Both the count and diagnostic are derived from the checker's actual output.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500" viewBox="0 0 900 500">
    <rect width="900" height="500" fill="white"/>
    <g font-family="sans-serif" fill="#172033">
      <text x="24" y="34" font-size="24" font-weight="bold">Trace endcap touching a pad</text>
      <text x="24" y="70" font-size="22" font-weight="bold" fill="${color}">Connectivity errors: ${errors.length}</text>
      <g transform="translate(0 85)">${boardSvg}</g>
      <text x="24" y="405" font-size="18">Endpoint center: ${centerGap.toFixed(3)} mm outside pad. Copper overlap: ${copperOverlap.toFixed(3)} mm.</text>
      <text x="24" y="435" font-size="18">Expected: connected. Both pads and the trace are on the top copper layer.</text>
      <text x="24" y="476" font-size="18" fill="${color}">${escapedMessage}</text>
    </g>
  </svg>`
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})

test("control: moving the same endcap away leaves a real copper gap", () => {
  const disconnected = structuredClone(circuitJson)
  const disconnectedTrace = disconnected.find(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )!
  const endpoint = disconnectedTrace.route.at(-1)!
  if (endpoint.route_type !== "wire")
    throw new Error("Expected a wire endpoint")
  endpoint.x -= 0.1
  expect(padLeft - (endpoint.x + traceWidth / 2)).toBeCloseTo(0.071, 9)
  expect(checkTracesAreContiguous(disconnected)).toMatchObject([
    missingConnection,
  ])
})
