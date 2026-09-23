import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace, SourceTrace } from "circuit-json"
import {
  checkPcbTraceSelfShorts,
  checkEachPcbTraceNonOverlapping,
  runAllRoutingChecks,
} from "../../index"

function circuit(points: number[][], width = 0.2): AnyCircuitElement[] {
  return [
    {
      type: "source_bus",
      source_bus_id: "bus",
      source_trace_ids: ["source"],
      max_length_skew: 0.1,
    },
    {
      type: "source_trace",
      source_trace_id: "source",
      connected_source_port_ids: [],
      connected_source_net_ids: [],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace",
      source_trace_id: "source",
      route: points.map(([x, y]) => ({
        route_type: "wire",
        x: x!,
        y: y!,
        width,
        layer: "top",
      })),
    },
  ]
}

const crossing = [
  [0, 0],
  [4, 4],
  [0, 4],
  [4, 0],
]

test("reports a matched trace crossing itself once, with location and source", () => {
  const errors = checkPcbTraceSelfShorts(circuit(crossing))
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    pcb_trace_id: "trace",
    source_trace_id: "source",
    center: { x: 2, y: 2 },
  })
  expect(errors[0]!.message).toContain("shorts to itself")
})

test.each([0.19, 0.2])(
  "detects copper contact between parallel legs separated by %s",
  (spacing) => {
    expect(
      checkPcbTraceSelfShorts(
        circuit([
          [0, 0],
          [4, 0],
          [4, spacing],
          [0, spacing],
        ]),
      ),
    ).toHaveLength(1)
  },
)

test("does not apply a clearance margin to separated copper", () => {
  expect(
    checkPcbTraceSelfShorts(
      circuit([
        [0, 0],
        [4, 0],
        [4, 0.21],
        [0, 0.21],
      ]),
    ),
  ).toEqual([])
})

test("allows normal corners, short subdivisions and duplicate route points", () => {
  expect(
    checkPcbTraceSelfShorts(
      circuit([
        [0, 0],
        [1, 0],
        [1, 0],
        [1, 0.05],
        [1, 1],
        [2, 1],
      ]),
    ),
  ).toEqual([])
})

test("allows crossings on different layers", () => {
  const json = circuit(crossing)
  const trace = json[2] as PcbTrace
  trace.route[2] = {
    ...trace.route[2]!,
    layer: "bottom",
  } as PcbTrace["route"][number]
  trace.route[3] = {
    ...trace.route[3]!,
    layer: "bottom",
  } as PcbTrace["route"][number]
  expect(checkPcbTraceSelfShorts(json)).toEqual([])
})

test("preserves ordinary same-net routing without a matching constraint", () => {
  expect(checkPcbTraceSelfShorts(circuit(crossing).slice(1))).toEqual([])
})

test("existing overlap and routing checks include self-shorts", async () => {
  for (const errors of [
    checkEachPcbTraceNonOverlapping(circuit(crossing)),
    await runAllRoutingChecks(circuit(crossing)),
  ]) {
    expect(
      errors.filter(
        (error) =>
          error.type === "pcb_trace_error" &&
          error.pcb_trace_error_id === "self_short_trace",
      ),
    ).toHaveLength(1)
  }
})

test("detects an immediately retraced segment", () => {
  expect(
    checkPcbTraceSelfShorts(
      circuit([
        [0, 0],
        [4, 0],
        [2, 0],
      ]),
    ),
  ).toHaveLength(1)
})

test("checks same-layer segments separated by via transitions", () => {
  const json = circuit(crossing)
  const trace = json[2] as PcbTrace
  trace.route.splice(
    2,
    0,
    { route_type: "via", x: 4, y: 4, from_layer: "top", to_layer: "bottom" },
    { route_type: "via", x: 0, y: 4, from_layer: "bottom", to_layer: "top" },
  )
  expect(checkPcbTraceSelfShorts(json)).toHaveLength(1)
})

test("uses trace names instead of IDs in diagnostic messages", () => {
  const json = circuit(crossing)
  const source = json[1] as SourceTrace
  source.name = "DATA_P"
  expect(checkPcbTraceSelfShorts(json)[0]!.message).toBe(
    'PCB trace "DATA_P" shorts to itself, bypassing part of its length-matched route',
  )
  delete source.name
  source.display_name = "USB data positive"
  expect(checkPcbTraceSelfShorts(json)[0]!.message).toContain(
    '"USB data positive"',
  )
})

test("does not expose IDs when names or endpoints are unavailable", () => {
  expect(checkPcbTraceSelfShorts(circuit(crossing))[0]!.message).toBe(
    'PCB trace "unnamed" shorts to itself, bypassing part of its length-matched route',
  )
})

function viaCircuit(diameter = 0.7): AnyCircuitElement[] {
  const json = circuit([
    [-4, 0],
    [4, 0],
    [4, 3],
    [0, 3],
    [0, 0.4],
  ])
  const trace = json[2] as PcbTrace
  trace.route.push(
    {
      route_type: "via",
      x: 0,
      y: 0.4,
      from_layer: "top",
      to_layer: "bottom",
      outer_diameter: diameter,
    },
    { route_type: "wire", x: 0, y: 0.4, width: 0.2, layer: "bottom" },
    { route_type: "wire", x: -2, y: 0.4, width: 0.2, layer: "bottom" },
  )
  return json
}

test("detects via copper touching a remote wire without intersecting centerlines", () => {
  const errors = checkPcbTraceSelfShorts(viaCircuit())
  expect(errors).toHaveLength(1)
  expect(errors[0]!.center).toEqual({ x: 0, y: 0.2 })
})

test("allows positive via copper clearance and intentional entry/exit", () => {
  expect(checkPcbTraceSelfShorts(viaCircuit(0.5))).toEqual([])
})

test("uses materialized via copper diameter and layers", () => {
  const json = viaCircuit(0.5)
  const via = {
    type: "pcb_via" as const,
    pcb_via_id: "via",
    pcb_trace_id: "trace",
    x: 0,
    y: 0.4,
    outer_diameter: 0.7,
    hole_diameter: 0.3,
    layers: ["top", "bottom"] as ("top" | "bottom")[],
  }
  json.push(via)
  expect(checkPcbTraceSelfShorts(json)).toHaveLength(1)
  via.layers = ["bottom"]
  expect(checkPcbTraceSelfShorts(json)).toEqual([])
})

test("allows short subdivisions of the normal via connection", () => {
  const json = viaCircuit(0.5)
  const trace = json[2] as PcbTrace
  trace.route.splice(4, 0, {
    route_type: "wire",
    x: 0,
    y: 0.5,
    width: 0.2,
    layer: "top",
  })
  expect(checkPcbTraceSelfShorts(json)).toEqual([])
})

test("checks via copper on intermediate layers of the board stack", () => {
  const json = viaCircuit()
  const trace = json[2] as PcbTrace
  for (const point of trace.route.slice(0, 2)) {
    if (point.route_type === "wire") point.layer = "inner1"
  }
  expect(checkPcbTraceSelfShorts(json)).toHaveLength(1)
})
