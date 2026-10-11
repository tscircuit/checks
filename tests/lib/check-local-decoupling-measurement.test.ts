import { expect, test } from "bun:test"
import type { AnyCircuitElement, SourceTrace } from "circuit-json"
import {
  checkPcbTraceLengths,
  checkPcbTraceLengthMeasurementWarnings,
} from "../../lib/check-pcb-trace-lengths"
import { measureConstrainedPcbPath } from "../../lib/util/measure-constrained-pcb-path"

const source: SourceTrace = {
  type: "source_trace",
  source_trace_id: "local",
  connected_source_port_ids: ["a", "b"],
  connected_source_net_ids: ["ground"],
  max_length: 5,
  max_length_constraint: { origin: "decoupling", source_port_ids: ["a", "b"] },
}
const fixture = (): AnyCircuitElement[] =>
  [
    source,
    { type: "source_net", source_net_id: "ground", name: "GND" },
    {
      type: "pcb_board",
      pcb_board_id: "board",
      num_layers: 2,
      thickness: 2,
      width: 10,
      height: 10,
      center: { x: 0, y: 0 },
    },
    {
      type: "pcb_port",
      pcb_port_id: "a",
      source_port_id: "a",
      pcb_component_id: "cap",
      x: 0,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "b",
      source_port_id: "b",
      pcb_component_id: "ic",
      x: 4,
      y: 0,
      layers: ["bottom"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "path",
      source_trace_id: "local",
      route: [
        {
          route_type: "wire",
          x: 0,
          y: 0,
          layer: "top",
          width: 0.2,
          start_pcb_port_id: "a",
        },
        { route_type: "wire", x: 2, y: 0, layer: "top", width: 0.2 },
        {
          route_type: "via",
          x: 2,
          y: 0,
          from_layer: "top",
          to_layer: "bottom",
        },
        { route_type: "wire", x: 2, y: 0, layer: "bottom", width: 0.2 },
        {
          route_type: "wire",
          x: 4,
          y: 0,
          layer: "bottom",
          width: 0.2,
          end_pcb_port_id: "b",
        },
      ],
    },
  ] as AnyCircuitElement[]

test("local path length includes actual through-board via depth", () => {
  const input = fixture()
  expect(checkPcbTraceLengths(input)).toEqual([
    expect.objectContaining({
      actual_trace_length: 6,
      maximum_trace_length: 5,
    }),
  ])
  expect(checkPcbTraceLengthMeasurementWarnings(input)).toEqual([])
})

test("unknown inner-layer depth is unresolved, never a zero-length via", () => {
  const input = fixture()
  for (const e of input) {
    if (e.type === "pcb_port" && e.pcb_port_id === "b") e.layers = ["inner1"]
    if (e.type === "pcb_trace")
      for (const p of e.route) {
        if (p.route_type === "via") p.to_layer = "inner1"
        if (p.route_type === "wire" && p.layer === "bottom") p.layer = "inner1"
      }
  }
  expect(checkPcbTraceLengths(input)).toEqual([])
  expect(checkPcbTraceLengthMeasurementWarnings(input)).toEqual([
    expect.objectContaining({ message: expect.stringContaining("unresolved") }),
  ])
})

test("a layer jump without emitted via copper is not a measurable connection", () => {
  const input = fixture()
  for (const element of input)
    if (element.type === "pcb_trace")
      element.route = element.route.filter(
        (point) => point.route_type !== "via",
      )
  expect(checkPcbTraceLengths(input)).toEqual([])
  expect(checkPcbTraceLengthMeasurementWarnings(input)).toEqual([
    expect.objectContaining({ message: expect.stringContaining("unresolved") }),
  ])
})

test("plane-connected returns report measurement limitations without erasing explicit limits", () => {
  const input = fixture()
  for (const e of input) {
    if (e.type === "pcb_port") e.layers = ["top"]
    if (e.type === "pcb_trace")
      e.route = [
        {
          route_type: "wire",
          x: 0,
          y: 0,
          layer: "top",
          width: 0.2,
          start_pcb_port_id: "a",
        },
        {
          route_type: "wire",
          x: 7,
          y: 0,
          layer: "top",
          width: 0.2,
          end_pcb_port_id: "b",
        },
      ]
  }
  input.push(
    ...([0, 4].map((x, i) => ({
      type: "pcb_smtpad",
      pcb_smtpad_id: `pad${i}`,
      pcb_port_id: i ? "b" : "a",
      pcb_component_id: i ? "ic" : "cap",
      shape: "rect",
      x,
      y: 0,
      width: 0.5,
      height: 0.5,
      layer: "top",
    })) as AnyCircuitElement[]),
  )
  input.push({
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "plane",
    source_net_id: "ground",
    layer: "top",
    shape: "brep",
    covered_with_solder_mask: true,
    brep_shape: {
      outer_ring: {
        vertices: [
          { x: -1, y: -1 },
          { x: 8, y: -1 },
          { x: 8, y: 1 },
          { x: -1, y: 1 },
        ],
      },
      inner_rings: [],
    },
  } as AnyCircuitElement)
  const before = structuredClone(input)
  expect(checkPcbTraceLengths(input)).toEqual([])
  expect(checkPcbTraceLengthMeasurementWarnings(input)[0].message).toContain(
    "copper plane",
  )
  expect(input).toEqual(before)
  const explicit = input.map((e) =>
    e.type === "source_trace"
      ? { ...e, max_length_constraint: { origin: "explicit" as const } }
      : e,
  )
  expect(checkPcbTraceLengths(explicit)).toEqual([
    expect.objectContaining({
      actual_trace_length: 7,
      maximum_trace_length: 5,
    }),
  ])
})

test("ambiguous targets require metadata while legacy explicit net constraints still fail", () => {
  const input = fixture()
  const ambiguous = {
    ...source,
    connected_source_port_ids: ["a"],
    max_length_constraint: { origin: "decoupling" as const },
  }
  const traces = input.filter((e) => e.type === "pcb_trace")
  expect(measureConstrainedPcbPath(input, ambiguous, traces).status).toBe(
    "unavailable",
  )
  const explicit = {
    ...ambiguous,
    max_length_constraint: { origin: "explicit" as const },
    max_length: 1,
  }
  expect(
    checkPcbTraceLengths(
      input.map((e) => (e.type === "source_trace" ? explicit : e)),
    ),
  ).toHaveLength(1)
})
