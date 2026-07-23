import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbTraceLengths, runAllRoutingChecks } from "../.."

const circuitJson = [
  {
    type: "source_component",
    source_component_id: "crystal",
    ftype: "simple_crystal",
    name: "Y1",
    frequency: 12_000_000,
  },
  {
    type: "source_component",
    source_component_id: "mcu",
    ftype: "simple_chip",
    name: "U1",
  },
  {
    type: "source_component",
    source_component_id: "load_capacitor",
    ftype: "simple_capacitor",
    name: "C1",
    capacitance: 10e-12,
  },
  {
    type: "source_component",
    source_component_id: "unrelated_resistor",
    ftype: "simple_resistor",
    name: "R1",
    resistance: 1_000,
  },
  {
    type: "source_port",
    source_port_id: "crystal_port",
    source_component_id: "crystal",
    name: "pin1",
    pin_number: 1,
    port_hints: ["1"],
  },
  {
    type: "source_port",
    source_port_id: "mcu_port",
    source_component_id: "mcu",
    name: "XTAL_IN",
    pin_number: 1,
    port_hints: ["XTAL_IN"],
  },
  {
    type: "source_port",
    source_port_id: "capacitor_port",
    source_component_id: "load_capacitor",
    name: "pin1",
    pin_number: 1,
    port_hints: ["1"],
  },
  {
    type: "source_port",
    source_port_id: "resistor_port",
    source_component_id: "unrelated_resistor",
    name: "pin1",
    pin_number: 1,
    port_hints: ["1"],
  },
  {
    type: "source_trace",
    source_trace_id: "crystal_trace",
    connected_source_port_ids: ["crystal_port"],
    connected_source_net_ids: ["crystal_net"],
    subcircuit_connectivity_map_key: "board_crystal_net",
  },
  {
    type: "source_trace",
    source_trace_id: "mcu_trace",
    connected_source_port_ids: ["mcu_port"],
    connected_source_net_ids: ["crystal_net"],
    subcircuit_connectivity_map_key: "board_crystal_net",
  },
  {
    type: "source_trace",
    source_trace_id: "capacitor_trace",
    connected_source_port_ids: ["capacitor_port"],
    connected_source_net_ids: ["crystal_net"],
    subcircuit_connectivity_map_key: "board_crystal_net",
  },
  {
    type: "source_trace",
    source_trace_id: "unrelated_trace",
    connected_source_port_ids: ["resistor_port"],
    connected_source_net_ids: ["unrelated_net"],
    subcircuit_connectivity_map_key: "board_unrelated_net",
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_to_mcu",
    source_trace_id: "mcu_trace",
    route: [
      { route_type: "wire", x: 0, y: 0, width: 0.15, layer: "top" },
      { route_type: "wire", x: 12, y: 0, width: 0.15, layer: "top" },
    ],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_to_capacitor",
    source_trace_id: "capacitor_trace",
    route: [
      { route_type: "wire", x: 0, y: 0, width: 0.15, layer: "top" },
      { route_type: "wire", x: 0, y: 11, width: 0.15, layer: "top" },
    ],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_unrelated",
    source_trace_id: "unrelated_trace",
    route: [
      { route_type: "wire", x: 0, y: 0, width: 0.15, layer: "top" },
      { route_type: "wire", x: 20, y: 0, width: 0.15, layer: "top" },
    ],
  },
] as AnyCircuitElement[]

test("warns for MCU and capacitor traces on a crystal net", () => {
  const warnings = checkPcbTraceLengths(circuitJson)

  expect(
    warnings.map((warning) => ({
      pcb_trace_id: warning.pcb_trace_id,
      actual_trace_length: warning.actual_trace_length,
      maximum_trace_length: warning.maximum_trace_length,
    })),
  ).toEqual([
    {
      pcb_trace_id: "pcb_trace_to_mcu",
      actual_trace_length: 12,
      maximum_trace_length: 10,
    },
    {
      pcb_trace_id: "pcb_trace_to_capacitor",
      actual_trace_length: 11,
      maximum_trace_length: 10,
    },
  ])
})

test("uses a configured crystal trace limit and preserves stricter trace limits", () => {
  const constrainedCircuitJson = circuitJson.map((element) => {
    if (
      element.type === "source_trace" &&
      element.source_trace_id === "crystal_trace"
    ) {
      return { ...element, max_length: 6 }
    }
    if (
      element.type === "source_trace" &&
      element.source_trace_id === "capacitor_trace"
    ) {
      return { ...element, max_length: 4 }
    }
    return element
  }) as AnyCircuitElement[]

  const warnings = checkPcbTraceLengths(constrainedCircuitJson)

  expect(
    warnings.map((warning) => [
      warning.pcb_trace_id,
      warning.maximum_trace_length,
    ]),
  ).toEqual([
    ["pcb_trace_to_mcu", 6],
    ["pcb_trace_to_capacitor", 4],
  ])
})

test("applies the default limit to a direct crystal trace without a connectivity key", () => {
  const directCrystalCircuitJson = [
    circuitJson.find(
      (element) =>
        element.type === "source_component" &&
        element.source_component_id === "crystal",
    ),
    circuitJson.find(
      (element) =>
        element.type === "source_port" &&
        element.source_port_id === "crystal_port",
    ),
    {
      type: "source_trace",
      source_trace_id: "direct_crystal_trace",
      connected_source_port_ids: ["crystal_port"],
      connected_source_net_ids: [],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "direct_crystal_pcb_trace",
      source_trace_id: "direct_crystal_trace",
      trace_length: 12,
      route: [],
    },
  ].filter(Boolean) as AnyCircuitElement[]

  expect(checkPcbTraceLengths(directCrystalCircuitJson)).toEqual([
    expect.objectContaining({
      pcb_trace_id: "direct_crystal_pcb_trace",
      actual_trace_length: 12,
      maximum_trace_length: 10,
    }),
  ])
})

test("is included in the routing check pipeline", async () => {
  const warnings = await runAllRoutingChecks(circuitJson)

  expect(
    warnings.filter((warning) => warning.type === "pcb_trace_too_long_warning"),
  ).toHaveLength(2)
})
