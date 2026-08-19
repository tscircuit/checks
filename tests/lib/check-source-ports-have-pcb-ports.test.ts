import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { containsCircuitJsonId } from "lib/util/get-readable-names"
import { checkSourcePortsHavePcbPorts, runAllPlacementChecks } from "../.."

const createCircuitJson = (): AnyCircuitElement[] => [
  {
    type: "pcb_board",
    pcb_board_id: "pcb_board_1",
    center: { x: 0, y: 0 },
    width: 20,
    height: 20,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
  },
  {
    type: "source_component",
    source_component_id: "source_component_1",
    ftype: "simple_chip",
    name: "U1",
    supplier_part_numbers: {},
    subcircuit_id: "subcircuit_1",
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_component_1",
    source_component_id: "source_component_1",
    center: { x: 0, y: 0 },
    width: 2,
    height: 2,
    layer: "top",
    rotation: 0,
    obstructs_within_bounds: false,
    subcircuit_id: "subcircuit_1",
  },
  {
    type: "source_port",
    source_port_id: "source_port_thermal",
    source_component_id: "source_component_1",
    name: "thermal_pad",
    pin_number: 89,
    port_hints: ["89", "thermal_pad"],
    subcircuit_id: "subcircuit_1",
  },
  {
    type: "source_port",
    source_port_id: "source_port_signal",
    source_component_id: "source_component_1",
    name: "signal",
    pin_number: 1,
    port_hints: ["1", "signal"],
    subcircuit_id: "subcircuit_1",
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_thermal",
    source_port_id: "source_port_thermal",
    pcb_component_id: "pcb_component_1",
    x: -0.5,
    y: 0,
    layers: ["top"],
    subcircuit_id: "subcircuit_1",
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_signal",
    source_port_id: "source_port_signal",
    pcb_component_id: "pcb_component_1",
    x: 0.5,
    y: 0,
    layers: ["top"],
    subcircuit_id: "subcircuit_1",
  },
  {
    type: "source_trace",
    source_trace_id: "source_trace_1",
    connected_source_port_ids: ["source_port_thermal", "source_port_signal"],
    connected_source_net_ids: [],
    subcircuit_id: "subcircuit_1",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_thermal",
    pcb_component_id: "pcb_component_1",
    pcb_port_id: "pcb_port_thermal",
    shape: "rect",
    x: -0.5,
    y: 0,
    width: 0.4,
    height: 0.4,
    layer: "top",
  },
]

describe("checkSourcePortsHavePcbPorts", () => {
  test("reports a connected source port whose PCB port is missing during placement checks", async () => {
    const circuitJson = createCircuitJson().filter(
      (element) =>
        element.type !== "pcb_port" ||
        element.pcb_port_id !== "pcb_port_thermal",
    )

    const results = await runAllPlacementChecks(circuitJson)

    expect(results).toContainEqual({
      type: "pcb_port_not_matched_error",
      pcb_error_id: "pcb_port_not_matched_source_port_thermal",
      error_type: "pcb_port_not_matched_error",
      message:
        "Source port U1.thermal_pad is connected but has no matching PCB port/pad mapping.",
      pcb_component_ids: ["pcb_component_1"],
      subcircuit_id: "subcircuit_1",
    })
  })

  test("returns no errors when every connected source port has a PCB port", () => {
    expect(checkSourcePortsHavePcbPorts(createCircuitJson())).toEqual([])
  })

  test("ignores an unconnected source port without a PCB port", () => {
    const circuitJson = createCircuitJson().filter(
      (element) =>
        element.type !== "source_trace" &&
        !(
          element.type === "pcb_port" &&
          element.pcb_port_id === "pcb_port_thermal"
        ),
    )

    expect(checkSourcePortsHavePcbPorts(circuitJson)).toEqual([])
  })

  test("ignores connected source ports in a source-only circuit", () => {
    const circuitJson = createCircuitJson().filter(
      (element) =>
        element.type !== "pcb_board" &&
        element.type !== "pcb_component" &&
        element.type !== "pcb_port",
    )

    expect(checkSourcePortsHavePcbPorts(circuitJson)).toEqual([])
  })

  test("reports a missing port only once when several traces reference it", () => {
    const circuitJson = createCircuitJson().filter(
      (element) =>
        element.type !== "pcb_port" ||
        element.pcb_port_id !== "pcb_port_thermal",
    )
    circuitJson.push({
      type: "source_trace",
      source_trace_id: "source_trace_2",
      connected_source_port_ids: ["source_port_thermal"],
      connected_source_net_ids: ["source_net_1"],
      subcircuit_id: "subcircuit_1",
    })

    expect(checkSourcePortsHavePcbPorts(circuitJson)).toHaveLength(1)
  })

  test("checks a source port connected to a source net", () => {
    const circuitJson = createCircuitJson().filter(
      (element) =>
        (element.type !== "pcb_port" ||
          element.pcb_port_id !== "pcb_port_thermal") &&
        element.type !== "source_trace",
    )
    circuitJson.push({
      type: "source_trace",
      source_trace_id: "source_trace_power",
      connected_source_port_ids: ["source_port_thermal"],
      connected_source_net_ids: ["source_net_ground"],
      subcircuit_id: "subcircuit_1",
    })

    expect(checkSourcePortsHavePcbPorts(circuitJson)).toHaveLength(1)
  })

  test("reports all missing mappings for a PCB component with no ports or pads", () => {
    const circuitJson = createCircuitJson().filter(
      (element) => element.type !== "pcb_port" && element.type !== "pcb_smtpad",
    )

    expect(checkSourcePortsHavePcbPorts(circuitJson)).toHaveLength(2)
  })

  test("does not cascade mapping errors from a missing footprint", () => {
    const circuitJson = createCircuitJson().filter(
      (element) => element.type !== "pcb_port" && element.type !== "pcb_smtpad",
    )
    circuitJson.push({
      type: "pcb_missing_footprint_error",
      pcb_missing_footprint_error_id: "pcb_missing_footprint_error_1",
      error_type: "pcb_missing_footprint_error",
      message: "No footprint specified for U1.",
      source_component_id: "source_component_1",
      subcircuit_id: "subcircuit_1",
    })

    expect(checkSourcePortsHavePcbPorts(circuitJson)).toEqual([])
  })

  test("does not accept a PCB port mapped to the wrong component", () => {
    const circuitJson = createCircuitJson()
    circuitJson.push({
      type: "pcb_component",
      pcb_component_id: "pcb_component_2",
      source_component_id: "source_component_2",
      center: { x: 4, y: 0 },
      width: 2,
      height: 2,
      layer: "top",
      rotation: 0,
      obstructs_within_bounds: false,
      subcircuit_id: "subcircuit_1",
    })
    const thermalPcbPort = circuitJson.find(
      (element) =>
        element.type === "pcb_port" &&
        element.source_port_id === "source_port_thermal",
    )
    if (thermalPcbPort?.type === "pcb_port") {
      thermalPcbPort.pcb_component_id = "pcb_component_2"
    }

    expect(checkSourcePortsHavePcbPorts(circuitJson)).toHaveLength(1)
  })

  test("follows source component internal connectivity from a traced port", () => {
    const circuitJson = createCircuitJson().filter(
      (element) =>
        element.type !== "pcb_port" ||
        element.pcb_port_id !== "pcb_port_thermal",
    )
    const sourceTrace = circuitJson.find(
      (element) => element.type === "source_trace",
    )
    const sourceComponent = circuitJson.find(
      (element) => element.type === "source_component",
    )
    if (sourceTrace?.type === "source_trace") {
      sourceTrace.connected_source_port_ids = ["source_port_signal"]
      sourceTrace.connected_source_net_ids = ["source_net_1"]
    }
    if (sourceComponent?.type === "source_component") {
      sourceComponent.internally_connected_source_port_ids = [
        ["source_port_signal", "source_port_thermal"],
      ]
    }

    const errors = checkSourcePortsHavePcbPorts(circuitJson)

    expect(errors).toHaveLength(1)
    expect(errors[0]?.pcb_error_id).toBe(
      "pcb_port_not_matched_source_port_thermal",
    )
  })

  test("follows source component internal connection records", () => {
    const circuitJson = createCircuitJson().filter(
      (element) =>
        element.type !== "pcb_port" ||
        element.pcb_port_id !== "pcb_port_thermal",
    )
    const sourceTrace = circuitJson.find(
      (element) => element.type === "source_trace",
    )
    if (sourceTrace?.type === "source_trace") {
      sourceTrace.connected_source_port_ids = ["source_port_signal"]
      sourceTrace.connected_source_net_ids = ["source_net_1"]
    }
    circuitJson.push({
      type: "source_component_internal_connection",
      source_component_internal_connection_id:
        "source_component_internal_connection_1",
      source_component_id: "source_component_1",
      source_port_ids: ["source_port_signal", "source_port_thermal"],
      subcircuit_id: "subcircuit_1",
    })

    const errors = checkSourcePortsHavePcbPorts(circuitJson)

    expect(errors).toHaveLength(1)
    expect(errors[0]?.pcb_error_id).toBe(
      "pcb_port_not_matched_source_port_thermal",
    )
  })

  test("does not expose Circuit JSON ids in its message", () => {
    const circuitJson = createCircuitJson().filter(
      (element) =>
        element.type !== "pcb_port" ||
        element.pcb_port_id !== "pcb_port_thermal",
    )
    const sourceComponent = circuitJson.find(
      (element) => element.type === "source_component",
    )
    const thermalPort = circuitJson.find(
      (element) => element.type === "source_port" && element.pin_number === 89,
    )
    if (sourceComponent?.type === "source_component") {
      sourceComponent.name = sourceComponent.source_component_id
    }
    if (thermalPort?.type === "source_port") {
      thermalPort.name = thermalPort.source_port_id
    }

    const [error] = checkSourcePortsHavePcbPorts(circuitJson)

    expect(error).toBeDefined()
    expect(containsCircuitJsonId(error!.message)).toBe(false)
  })
})
