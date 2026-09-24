import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace, PcbSmtPad } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import literalCircuit from "../assets/pedometer-v1.1.3-missing-via.circuit.json"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { checkEachPcbPortConnectedToPcbTraces } from "../../lib/check-each-pcb-port-connected-to-pcb-trace"
import { runAllRoutingChecks } from "../../lib/run-all-checks"

const TRACE_ID = "source_net_6_mst1_0"
const PORT_ID = "pcb_port_66"
const SOURCE_TRACE_ID = "source_trace_83"
const location = { x: -8.20005, y: -3.199898 }
const freshCircuit = () =>
  structuredClone(literalCircuit) as AnyCircuitElement[]
const getTrace = (circuit = freshCircuit()) =>
  circuit.find(
    (e): e is PcbTrace => e.type === "pcb_trace" && e.pcb_trace_id === TRACE_ID,
  )!
const getPad = () =>
  freshCircuit().find(
    (e): e is PcbSmtPad => e.type === "pcb_smtpad" && e.pcb_port_id === PORT_ID,
  )!
const nearEndpoint = (p: { x: number; y: number }) =>
  Math.hypot(p.x - location.x, p.y - location.y) < 0.01

// Do not confuse unrelated clearance errors elsewhere on this board with a
// missing layer transition. This is the diagnostic the repro expects.
function diagnosesMissingConnection(error: AnyCircuitElement) {
  if (error.type === "pcb_trace_error") {
    return error.pcb_trace_id === TRACE_ID
  }
  if (error.type === "pcb_port_not_connected_error") {
    return error.pcb_port_ids.includes(PORT_ID)
  }
  return false
}

test("literal published fixture is preserved byte-for-byte", () => {
  const bytes = readFileSync(
    new URL(
      "../assets/pedometer-v1.1.3-missing-via.circuit.json",
      import.meta.url,
    ),
  )
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    "384dff968fe32973bb6b1736216a0d754ce44283f269d087da7546204ef430cd",
  )
})

test("PMID route ends on inner2 at U2 B2, a top-only pad, without a via", () => {
  const circuit = freshCircuit()
  const trace = getTrace(circuit)
  const pad = getPad()
  expect(trace.source_trace_id).toBe(SOURCE_TRACE_ID)
  expect(trace.route.at(-1)).toEqual({
    route_type: "wire",
    ...location,
    width: 0.1,
    layer: "inner2",
    end_pcb_port_id: PORT_ID,
  })
  expect(pad).toMatchObject({
    x: location.x,
    y: location.y,
    layer: "top",
    pcb_component_id: "pcb_component_18",
    port_hints: ["pin6"],
  })
  expect(
    circuit.find((e) => e.type === "pcb_port" && e.pcb_port_id === PORT_ID),
  ).toMatchObject({ layers: ["top"] })
  // Check every route and standalone via, not just this route's last point.
  expect(
    circuit.filter((e) => e.type === "pcb_via" && nearEndpoint(e)),
  ).toHaveLength(0)
  expect(
    circuit
      .filter((e): e is PcbTrace => e.type === "pcb_trace")
      .flatMap((e) => e.route)
      .filter((p) => p.route_type === "via" && nearEndpoint(p)),
  ).toHaveLength(0)
  // The real via at the OTHER end of the inner2 segment is still present.
  expect(trace.route.filter((p) => p.route_type === "via")).toMatchObject([
    {
      route_type: "via",
      x: -9.224567805024478,
      y: -1.8811807033690149,
      from_layer: "top",
      to_layer: "inner2",
    },
  ])
  // The source trace has one port plus a net, so the port checker skips it.
  expect(
    circuit.find(
      (e) => e.type === "source_trace" && e.source_trace_id === SOURCE_TRACE_ID,
    ),
  ).toMatchObject({
    connected_source_port_ids: ["source_port_80"],
    connected_source_net_ids: ["source_net_6"],
  })
})

test("all checker entry points execute without throwing on the full fixture", async () => {
  expect(Array.isArray(checkTracesAreContiguous(freshCircuit()))).toBe(true)
  expect(
    Array.isArray(checkEachPcbPortConnectedToPcbTraces(freshCircuit())),
  ).toBe(true)
  expect(Array.isArray(await runAllRoutingChecks(freshCircuit()))).toBe(true)
})

test("control: an explicit endpoint via and top landing remove the layer mismatch", async () => {
  const circuit = freshCircuit()
  const trace = getTrace(circuit)
  const endpoint = trace.route.at(-1)!
  if (endpoint.route_type !== "wire") throw new Error("Expected wire endpoint")
  delete endpoint.end_pcb_port_id
  trace.route.push(
    { route_type: "via", ...location, from_layer: "inner2", to_layer: "top" },
    {
      route_type: "wire",
      ...location,
      layer: "top",
      width: 0.1,
      end_pcb_port_id: PORT_ID,
    },
  )
  circuit.push({
    type: "pcb_via",
    pcb_via_id: "repro-control-via",
    pcb_trace_id: TRACE_ID,
    ...location,
    hole_diameter: 0.15,
    outer_diameter: 0.3,
    layers: ["top", "inner1", "inner2", "bottom"],
    from_layer: "inner2",
    to_layer: "top",
  })
  expect(trace.route.at(-1)).toMatchObject({ layer: getPad().layer })
  expect(
    checkTracesAreContiguous(circuit).some(diagnosesMissingConnection),
  ).toBe(false)
  expect(
    (await runAllRoutingChecks(circuit)).some(diagnosesMissingConnection),
  ).toBe(false)
  // The control is an in-memory change only; the real fixture still lacks it.
  expect(getTrace().route.at(-1)).toMatchObject({ layer: "inner2" })
})

test.failing(
  "continuity checker should report the missing inner2-to-top connection",
  () => {
    expect(
      checkTracesAreContiguous(freshCircuit()).some(diagnosesMissingConnection),
    ).toBe(true)
  },
)

test.failing(
  "port checker should not accept the endpoint port ID as copper connectivity",
  () => {
    expect(
      checkEachPcbPortConnectedToPcbTraces(freshCircuit()).some(
        diagnosesMissingConnection,
      ),
    ).toBe(true)
  },
)

test.failing(
  "aggregate routing checks should report this missing via",
  async () => {
    expect(
      (await runAllRoutingChecks(freshCircuit())).some(
        diagnosesMissingConnection,
      ),
    ).toBe(true)
  },
)

// Snapshot annotation only: neither the input JSON nor the checker's result is
// modified. The orange segment is the literal route, red is top-layer copper.
function zoomSnapshot() {
  const width = 1200
  const height = 1000
  const viewport = { minX: -9.7, maxX: -7.5, minY: -3.7, maxY: -1.3 }
  const svg = convertCircuitJsonToPcbSvg(freshCircuit(), {
    width,
    height,
    viewport,
    showSolderMask: false,
    colorOverrides: {
      copper: { top: "#c93636", inner2: "#f0a332", bottom: "#568cce" },
      silkscreen: { top: "transparent", bottom: "transparent" },
    },
  })
  const scale = Math.min(
    width / (viewport.maxX - viewport.minX),
    height / (viewport.maxY - viewport.minY),
  )
  const project = (p: { x: number; y: number }) => ({
    x: width / 2 + (p.x - (viewport.minX + viewport.maxX) / 2) * scale,
    y: height / 2 - (p.y - (viewport.minY + viewport.maxY) / 2) * scale,
  })
  const points = getTrace().route.flatMap((point) =>
    point.route_type === "wire" && point.layer === "inner2"
      ? [project(point)]
      : [],
  )
  const endpoint = project(location)
  const existingVia = project({ x: -9.224567805024478, y: -1.8811807033690149 })
  const overlay = `<g font-family="Arial, sans-serif">
    <polyline points="${points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="#f0a332" stroke-width="${0.1 * scale}" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${existingVia.x}" cy="${existingVia.y}" r="${0.075 * scale}" fill="#ff19da"/>
    <circle cx="${endpoint.x}" cy="${endpoint.y}" r="62" fill="none" stroke="#ffffff" stroke-width="4" stroke-dasharray="9 6"/>
    <rect x="20" y="16" width="1160" height="136" rx="12" fill="#101923"/>
    <text x="42" y="55" fill="white" font-size="28">PMID: inner2 trace ends on a top-only U2 B2 pad</text>
    <text x="42" y="91" fill="#f0a332" font-size="24">Orange = inner2  /  Red = top  /  Magenta = existing drill</text>
    <text x="42" y="126" fill="#c8d5e5" font-size="22">Literal v1.1.3 JSON • source_net_6_mst1_0 • no via at the circled endpoint</text>
    <path d="M 1020 660 L ${endpoint.x + 53} ${endpoint.y - 48}" fill="none" stroke="white" stroke-width="5"/>
    <path d="M ${endpoint.x + 53} ${endpoint.y - 48} l 27 -5 l -14 -18 Z" fill="white"/>
    <rect x="480" y="910" width="700" height="66" rx="8" fill="#101923"/>
    <text x="500" y="950" fill="white" font-size="24">Missing transition at (-8.20005, -3.199898) mm</text>
  </g>`
  // The viewport fixes the world-coordinate crop; an explicit SVG viewBox
  // keeps that same zoom when the snapshot is resized by a review UI.
  return svg
    .replace("<svg ", `<svg viewBox="0 0 ${width} ${height}" `)
    .replace("</svg>", `${overlay}</svg>`)
}

test("zoomed viewBox snapshot identifies the actual missing via", () => {
  const svg = zoomSnapshot()
  expect(svg).toContain('viewBox="0 0 1200 1000"')
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
