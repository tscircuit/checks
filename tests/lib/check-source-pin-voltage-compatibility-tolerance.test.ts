import { expect, test } from "bun:test"
import { checkSourcePinVoltageCompatibility, runAllNetlistChecks } from "../.."
import { voltageCompatibilityFixture } from "../fixtures/voltage-compatibility"

test("explicit pin voltage tolerance accepts inclusive bounds without weakening other pins", async () => {
  for (const [providedVoltage, requiredVoltage, errorCount] of [
    [3.3, 3.3, 0],
    [3.135, 3.3, 0],
    [3.465, 3.3, 0],
    [3.1349, 3.3, 1],
    [3.4651, 3.3, 1],
    [-5.25, -5, 0],
    [-4.75, -5, 0],
    [-5.251, -5, 1],
    [5, -5, 1],
    [0, 0, 0],
    [0.001, 0, 1],
  ] as const) {
    const circuitJson = voltageCompatibilityFixture({
      providedVoltage,
      requiredVoltage,
      requiredVoltageTolerance: 0.05,
    })
    expect(checkSourcePinVoltageCompatibility(circuitJson)).toHaveLength(
      errorCount,
    )
    expect(await runAllNetlistChecks(circuitJson)).toHaveLength(errorCount)
  }

  for (const tolerance of [undefined, 0]) {
    expect(
      checkSourcePinVoltageCompatibility(
        voltageCompatibilityFixture({
          providedVoltage: 3.4,
          requiredVoltage: 3.3,
          requiredVoltageTolerance: tolerance,
        }),
      ),
    ).toHaveLength(1)
  }
  const circuitJson = voltageCompatibilityFixture({
    providedVoltage: 3.4,
    requiredVoltage: 3.3,
    requiredVoltageTolerance: 0.05,
  })
  circuitJson.push(
    {
      type: "source_port",
      source_port_id: "source_port_exact_consumer",
      source_component_id: "source_component_consumer",
      name: "EXACT_AVCC",
      requires_voltage: 3.3,
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_exact_consumer",
      connected_source_port_ids: ["source_port_exact_consumer"],
      connected_source_net_ids: ["source_net_avcc"],
    },
    {
      type: "source_port",
      source_port_id: "source_port_bad_supply",
      source_component_id: "source_component_supply",
      name: "BAD_VOUT",
      provides_voltage: 5,
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_bad_supply",
      connected_source_port_ids: ["source_port_bad_supply"],
      connected_source_net_ids: ["source_net_avcc"],
    },
  )
  const errors = await runAllNetlistChecks(
    JSON.parse(JSON.stringify(circuitJson)),
  )
  expect(errors).toHaveLength(3)
  expect(
    errors.map((error) => "source_port_ids" in error && error.source_port_ids),
  ).toContainEqual(["source_port_consumer", "source_port_bad_supply"])
})
