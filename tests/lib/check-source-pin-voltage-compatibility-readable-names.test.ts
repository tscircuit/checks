import { expect, test } from "bun:test"
import { checkSourcePinVoltageCompatibility } from "../.."
import { containsCircuitJsonId } from "lib/util/get-readable-names"
import { voltageCompatibilityFixture } from "../fixtures/voltage-compatibility"

test("voltage diagnostics identify pins without putting internal identifiers in messages", () => {
  for (const useIdsAsNames of [false, true]) {
    const circuitJson = voltageCompatibilityFixture()
    for (const element of circuitJson) {
      if (element.type === "source_port")
        element.name = useIdsAsNames ? element.source_port_id : ""
      if (element.type === "source_component")
        element.name = useIdsAsNames ? element.source_component_id : ""
    }
    const errors = checkSourcePinVoltageCompatibility(circuitJson)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe(
      "unnamed component.unnamed pin requires 2.8 V, but is connected to unnamed component.unnamed pin, which provides 1.8 V.",
    )
    expect(containsCircuitJsonId(errors[0].message)).toBe(false)
    expect(errors[0].source_port_ids).toEqual([
      "source_port_consumer",
      "source_port_supply",
    ])
  }
})
