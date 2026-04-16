import { expect, test } from "bun:test"
import { checkSourceTracesMatchPcbTraceThickness } from "lib/check-source-traces-match-pcb-trace-thickness"
import {
  runAllChecks,
  runAllNetlistChecks,
  runAllPinSpecificationChecks,
  runAllPlacementChecks,
  runAllRoutingChecks,
} from "lib/run-all-checks"
import type { AnyCircuitElement } from "circuit-json"
import { containsCircuitJsonId } from "lib/util/get-readable-names"

test("runAllChecks executes checks on tscircuit code", async () => {
  // Simple circuit JSON with a resistor component (no PCB traces, so should have no errors)
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "R1",
      ftype: "simple_resistor",
      name: "R1",
      resistance: 1000,
      supplier_part_numbers: {},
    },
    {
      type: "source_port",
      source_port_id: "R1_pin1",
      name: "pin1",
      pin_number: 1,
      port_hints: ["1"],
      source_component_id: "R1",
    },
    {
      type: "source_port",
      source_port_id: "R1_pin2",
      name: "pin2",
      pin_number: 2,
      port_hints: ["2"],
      source_component_id: "R1",
    },
  ]

  const errors = await runAllChecks(circuitJson)
  expect(Array.isArray(errors)).toBe(true)
  expect(errors.length).toBe(0)
})

test("runAllNetlistChecks excludes routing-only pcb trace connectivity checks", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "source_component_1",
      ftype: "simple_resistor",
      name: "R1",
      resistance: 1000,
      supplier_part_numbers: {},
    },
    {
      type: "source_port",
      source_port_id: "source_port_1",
      source_component_id: "source_component_1",
      name: "pin1",
      pin_number: 1,
      port_hints: ["1"],
    },
    {
      type: "source_port",
      source_port_id: "source_port_2",
      source_component_id: "source_component_1",
      name: "pin2",
      pin_number: 2,
      port_hints: ["2"],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_1",
      connected_source_port_ids: ["source_port_1", "source_port_2"],
      connected_source_net_ids: [],
    },
  ]

  const netlistErrors = await runAllNetlistChecks(circuitJson)
  const routingErrors = await runAllRoutingChecks(circuitJson)

  expect(netlistErrors).toEqual([])
  expect(routingErrors.length).toBeGreaterThan(0)
})

test("runAllRoutingChecks excludes trace thickness warnings", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "source_component_1",
      ftype: "simple_pin_header",
      name: "PWR",
      pin_count: 1,
      gender: "male",
    },
    {
      type: "source_component",
      source_component_id: "source_component_2",
      ftype: "simple_chip",
      name: "TINY_CHIP",
    },
    {
      type: "source_port",
      source_port_id: "source_port_1",
      source_component_id: "source_component_1",
      name: "pin1",
      pin_number: 1,
      port_hints: ["pin1"],
    },
    {
      type: "source_port",
      source_port_id: "source_port_2",
      source_component_id: "source_component_2",
      name: "VDD",
      pin_number: 1,
      port_hints: ["VDD"],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_1",
      connected_source_port_ids: ["source_port_1", "source_port_2"],
      connected_source_net_ids: [],
      display_name: "PWR -> TINY_CHIP.VDD",
      min_trace_thickness: 1,
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_1",
      source_port_id: "source_port_1",
      pcb_component_id: "pcb_component_1",
      x: -10,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_2",
      source_port_id: "source_port_2",
      pcb_component_id: "pcb_component_2",
      x: 10,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_1",
      source_trace_id: "source_trace_1",
      route: [
        {
          route_type: "wire",
          x: -10,
          y: 0,
          width: 0.15,
          layer: "top",
          start_pcb_port_id: "pcb_port_1",
        },
        {
          route_type: "wire",
          x: 10,
          y: 0,
          width: 0.15,
          layer: "top",
          end_pcb_port_id: "pcb_port_2",
        },
      ],
    },
  ]

  const standaloneWarnings =
    checkSourceTracesMatchPcbTraceThickness(circuitJson)
  const routingIssues = await runAllRoutingChecks(circuitJson)

  expect(standaloneWarnings).toHaveLength(1)
  expect(routingIssues).toEqual([])
})

test("runAllChecks equals placement + netlist + pin specification + routing checks", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "pcb_board_1",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
    },
    {
      type: "source_component",
      source_component_id: "source_component_1",
      ftype: "simple_resistor",
      name: "R1",
      resistance: 1000,
      supplier_part_numbers: {},
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_component_1",
      source_component_id: "source_component_1",
      center: { x: 6, y: 0 },
      width: 8,
      height: 2,
      layer: "top",
      rotation: 0,
      obstructs_within_bounds: false,
    },
    {
      type: "source_port",
      source_port_id: "source_port_1",
      source_component_id: "source_component_1",
      name: "pin1",
      pin_number: 1,
      port_hints: ["1"],
    },
    {
      type: "source_port",
      source_port_id: "source_port_2",
      source_component_id: "source_component_1",
      name: "pin2",
      pin_number: 2,
      port_hints: ["2"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_1",
      source_port_id: "source_port_1",
      pcb_component_id: "pcb_component_1",
      x: 0,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_2",
      source_port_id: "source_port_2",
      pcb_component_id: "pcb_component_2",
      x: 5,
      y: 0,
      layers: ["top"],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_1",
      connected_source_port_ids: ["source_port_1", "source_port_2"],
      connected_source_net_ids: [],
    },
  ]

  const allChecksErrors = await runAllChecks(circuitJson)
  const placementErrors = await runAllPlacementChecks(circuitJson)
  const netlistErrors = await runAllNetlistChecks(circuitJson)
  const pinSpecificationErrors = await runAllPinSpecificationChecks(circuitJson)
  const routingErrors = await runAllRoutingChecks(circuitJson)

  expect(allChecksErrors).toEqual([
    ...placementErrors,
    ...netlistErrors,
    ...pinSpecificationErrors,
    ...routingErrors,
  ])
})

test("runAllChecks error messages never expose circuit-json ids", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "pcb_board_1",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
    },
    {
      type: "source_component",
      source_component_id: "source_component_1",
      ftype: "simple_resistor",
      name: "R1",
      resistance: 1000,
      supplier_part_numbers: {},
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_component_1",
      source_component_id: "source_component_1",
      center: { x: 6, y: 0 },
      width: 8,
      height: 2,
      layer: "top",
      rotation: 0,
      obstructs_within_bounds: false,
    },
    {
      type: "source_port",
      source_port_id: "source_port_1",
      source_component_id: "source_component_1",
      name: "pin1",
      pin_number: 1,
      port_hints: ["1"],
    },
    {
      type: "source_port",
      source_port_id: "source_port_2",
      source_component_id: "source_component_1",
      name: "pin2",
      pin_number: 2,
      port_hints: ["2"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_1",
      source_port_id: "source_port_1",
      pcb_component_id: "pcb_component_1",
      x: 0,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_2",
      source_port_id: "source_port_2",
      pcb_component_id: "pcb_component_2",
      x: 5,
      y: 0,
      layers: ["top"],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_1",
      connected_source_port_ids: ["source_port_1", "source_port_2"],
      connected_source_net_ids: [],
    },
  ]

  const errors = await runAllChecks(circuitJson)
  expect(errors.length).toBeGreaterThan(0)
  expect(errors.every((error) => !containsCircuitJsonId(error.message))).toBe(
    true,
  )
})
