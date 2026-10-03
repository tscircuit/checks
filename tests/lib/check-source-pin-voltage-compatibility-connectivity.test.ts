import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkSourcePinVoltageCompatibility } from "../.."
import { voltageCompatibilityFixture } from "../fixtures/voltage-compatibility"

test("voltage checks follow transitive source connections and both internal connection forms", () => {
  for (const internalConnectionForm of ["component", "record"]) {
    const circuitJson = voltageCompatibilityFixture()
    circuitJson.push({
      type: "source_port",
      source_port_id: "source_port_supply_alias",
      source_component_id: "source_component_supply",
      name: "VOUT2",
    })
    for (const element of circuitJson) {
      if (
        element.type === "source_trace" &&
        element.source_trace_id === "source_trace_supply"
      ) {
        element.connected_source_port_ids = ["source_port_supply_alias"]
      }
      if (
        element.type === "source_component" &&
        element.name === "U_REG" &&
        internalConnectionForm === "component"
      ) {
        element.internally_connected_source_port_ids = [
          ["source_port_supply", "source_port_supply_alias"],
        ]
      }
    }
    if (internalConnectionForm === "record") {
      circuitJson.push({
        type: "source_component_internal_connection",
        source_component_internal_connection_id:
          "source_component_internal_connection_supply",
        source_component_id: "source_component_supply",
        source_port_ids: ["source_port_supply", "source_port_supply_alias"],
      })
    }
    // Another trace on the same net must not duplicate the error.
    circuitJson.push({
      type: "source_trace",
      source_trace_id: "source_trace_duplicate",
      connected_source_port_ids: ["source_port_consumer"],
      connected_source_net_ids: ["source_net_avcc"],
    })
    expect(checkSourcePinVoltageCompatibility(circuitJson)).toHaveLength(1)
  }
  const directTraceCircuit: AnyCircuitElement[] =
    voltageCompatibilityFixture().filter(
      (element) => element.type !== "source_trace",
    )
  directTraceCircuit.push({
    type: "source_trace",
    source_trace_id: "source_trace_direct",
    connected_source_port_ids: ["source_port_supply", "source_port_consumer"],
    connected_source_net_ids: [],
  })
  expect(checkSourcePinVoltageCompatibility(directTraceCircuit)).toHaveLength(1)
})
