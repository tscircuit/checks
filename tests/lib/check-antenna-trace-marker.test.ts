import { describe, expect, test } from "bun:test"
import { type AnyCircuitElement, type PcbTrace, pcb_trace } from "circuit-json"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"

function antennaCircuit(is_antenna_trace?: boolean): AnyCircuitElement[] {
  const trace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "radiator",
    source_trace_id: "source_trace_1",
    pcb_component_id: "pcb_component_1",
    route: [
      { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
      { route_type: "wire", x: 4, y: 0, width: 0.2, layer: "top" },
    ],
  }
  if (is_antenna_trace !== undefined) {
    trace.is_antenna_trace = is_antenna_trace
  }
  return [
    {
      type: "source_component",
      source_component_id: "source_component_1",
      name: "ANT1",
      ftype: "simple_chip",
    },
    {
      type: "source_port",
      source_port_id: "source_port_1",
      source_component_id: "source_component_1",
      name: "feed",
      pin_number: 1,
      port_hints: ["feed", "feed1"],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_1",
      name: "ANT1_pcb_path",
      connected_source_port_ids: ["source_port_1"],
      connected_source_net_ids: [],
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_component_1",
      source_component_id: "source_component_1",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      rotation: 0,
      obstructs_within_bounds: true,
      layer: "top",
    },
    pcb_trace.parse(trace),
  ]
}

describe("antenna trace marker", () => {
  test("explicit true exempts open radiator endpoints without naming metadata", () => {
    const circuitJson = antennaCircuit(true).filter(
      (element) => element.type === "pcb_trace",
    )
    // Current checker ignores the marker and reports both intentional ends.
    expect(checkTracesAreContiguous(circuitJson)).toHaveLength(2)
  })

  for (const [label, marker] of [
    ["false", false],
    ["omitted", undefined],
  ] as const) {
    test(`${label} is checked despite antenna names, feed aliases, and component ownership`, () => {
      const errors = checkTracesAreContiguous(antennaCircuit(marker))
      expect(errors).toHaveLength(2)
      expect(errors.map((error) => error.center)).toEqual([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ])
    })
  }

  test("an unmarked feed sharing the radiator's source and component stays checked", () => {
    const circuitJson = antennaCircuit(true)
    const radiator = circuitJson.find(
      (element): element is PcbTrace => element.type === "pcb_trace",
    )!
    circuitJson.push({
      type: "pcb_trace",
      source_trace_id: radiator.source_trace_id,
      pcb_component_id: radiator.pcb_component_id,
      is_antenna_trace: false,
      pcb_trace_id: "feed",
      route: [
        { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
        { route_type: "wire", x: 0, y: -3, width: 0.2, layer: "top" },
      ],
    })
    const errors = checkTracesAreContiguous(circuitJson)
    // Current checker reports the intentional radiator end as well as the feed.
    expect(errors.map((error) => error.pcb_trace_id)).toEqual([
      "radiator",
      "feed",
    ])
    expect(errors[1]).toMatchObject({
      pcb_trace_id: "feed",
      center: { x: 0, y: -3 },
    })
  })
})

test("marked antenna copper still requires its declared port connection", () => {
  const circuitJson = antennaCircuit(true)
  circuitJson.push(
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_1",
      source_port_id: "source_port_1",
      pcb_component_id: "pcb_component_1",
      x: 10,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_1",
      pcb_port_id: "pcb_port_1",
      pcb_component_id: "pcb_component_1",
      shape: "rect",
      x: 10,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
  )
  const errors = checkTracesAreContiguous(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("missing a connection")
  expect(errors[0].pcb_port_ids).toEqual(["pcb_port_1"])
})
