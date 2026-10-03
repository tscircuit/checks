import { expect, test } from "bun:test"
import { checkSourcePinVoltageCompatibility } from "../.."
import { voltageCompatibilityFixture } from "../fixtures/voltage-compatibility"

test("voltage checks normalize scalar units, preserve zero and polarity, and skip undocumented values", () => {
  for (const [providedVoltage, requiredVoltage, errorCount] of [
    ["1800mV", "2.8V", 1],
    ["2800mV", 2.8, 0],
    ["2.8", "2.8V", 0],
    [0, 2.8, 1],
    [0, "0V", 0],
    [-5, "-5V", 0],
    [5, "-5V", 1],
    [0.1 + 0.2, 0.3, 0],
    ["1.8-3.3V", 2.8, 0],
    [1.8, "2.8 V when enabled", 0],
    ["unknown", 2.8, 0],
    [Number.NaN, 2.8, 0],
    [1.8, Number.POSITIVE_INFINITY, 0],
  ] as const) {
    const circuitJson = voltageCompatibilityFixture({
      providedVoltage,
      requiredVoltage,
    })
    expect(checkSourcePinVoltageCompatibility(circuitJson)).toHaveLength(
      errorCount,
    )
  }
  for (const attribute of ["provides_voltage", "requires_voltage"] as const) {
    const circuitJson = voltageCompatibilityFixture()
    for (const element of circuitJson) {
      if (element.type === "source_port") delete element[attribute]
    }
    expect(checkSourcePinVoltageCompatibility(circuitJson)).toEqual([])
  }
})
