import { expect, test } from "bun:test"
import { checkSourcePinVoltageCompatibility } from "../.."
import { voltageCompatibilityFixture } from "../fixtures/voltage-compatibility"

test("a compatible supply does not hide another incompatible supply on the same net", () => {
  const circuitJson = voltageCompatibilityFixture()
  circuitJson.push(
    {
      type: "source_port",
      source_port_id: "source_port_compatible_supply",
      source_component_id: "source_component_supply",
      name: "OTHER_VOUT",
      provides_voltage: 2.8,
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_compatible_supply",
      connected_source_port_ids: ["source_port_compatible_supply"],
      connected_source_net_ids: ["source_net_avcc"],
    },
  )
  const errors = checkSourcePinVoltageCompatibility(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].source_port_ids).toEqual([
    "source_port_consumer",
    "source_port_supply",
  ])
})
