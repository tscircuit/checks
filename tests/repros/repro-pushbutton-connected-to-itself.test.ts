import { expect, test } from "bun:test"
import {
  type SchematicPort,
  type SourcePort,
  any_circuit_element,
} from "circuit-json"
import { runAllNetlistChecks } from "../.."
import pushbuttonSelfConnection from "../assets/pedometer-pushbutton-self-connection.json"

test("repro: pushbutton schematic contacts resolve to the same net", async () => {
  const circuitJson = pushbuttonSelfConnection.map((element) =>
    any_circuit_element.parse(element),
  )
  const schematicSourcePortIds = circuitJson
    .filter(
      (element): element is SchematicPort => element.type === "schematic_port",
    )
    .map((schematicPort) => schematicPort.source_port_id)
  const schematicContactConnectivityKeys = circuitJson
    .filter(
      (element): element is SourcePort =>
        element.type === "source_port" &&
        schematicSourcePortIds.includes(element.source_port_id),
    )
    .map((sourcePort) => sourcePort.subcircuit_connectivity_map_key)

  expect(schematicContactConnectivityKeys).toHaveLength(2)
  expect(new Set(schematicContactConnectivityKeys).size).toBe(1)
  expect(await runAllNetlistChecks(circuitJson)).toMatchObject([
    {
      type: "source_component_misconfigured_error",
      message:
        "Pushbutton SW1_WAKE has both schematic contacts connected to the same net. Check internallyConnectedPins and the footprint pin mapping.",
      source_component_ids: ["source_component_2"],
      source_port_ids: ["source_port_15", "source_port_16"],
      is_fatal: true,
    },
  ])
})

test("internally grouped pushbutton contacts resolve to different nets", async () => {
  const circuitJson = pushbuttonSelfConnection.map((element) => {
    if (
      element.type === "source_component" &&
      element.ftype === "simple_push_button"
    ) {
      return any_circuit_element.parse({
        ...element,
        internally_connected_source_port_ids: [
          ["source_port_15", "source_port_16"],
          ["source_port_17", "source_port_18"],
        ],
      })
    }
    if (
      element.type === "schematic_port" &&
      element.schematic_port_id === "schematic_port_16"
    ) {
      return any_circuit_element.parse({
        ...element,
        source_port_id: "source_port_17",
      })
    }
    return any_circuit_element.parse(element)
  })

  expect(await runAllNetlistChecks(circuitJson)).toEqual([])
})
