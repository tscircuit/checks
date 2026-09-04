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
  expect(await runAllNetlistChecks(circuitJson)).toHaveLength(0)
})
