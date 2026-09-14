import { expect, test } from "bun:test"
import { checkSchematicComponentMissingReferenceDesignatorText } from "lib/check-schematic-component-missing-reference-designator-text"
import { createReferenceDesignatorCircuitJson } from "tests/fixtures/create-reference-designator-circuit-json"

const checkSymbol = (
  symbolName: string,
  name = "R_ENC_SDA",
  displayName?: string,
) => {
  const circuitJson = createReferenceDesignatorCircuitJson({
    name,
    displayName,
  })
  const schematicComponent = circuitJson.find(
    (element) => element.type === "schematic_component",
  )!
  schematicComponent.symbol_name = symbolName
  return checkSchematicComponentMissingReferenceDesignatorText(circuitJson)
}

test("accepts reference designators rendered by library symbols without schematic_text", () => {
  for (const symbolName of [
    "boxresistor_down",
    "boxresistor_right",
    "capacitor_right",
    "diode_right",
  ]) {
    expect(checkSymbol(symbolName)).toHaveLength(0)
  }
  expect(
    checkSymbol("boxresistor_down", "unnamed_resistor1", "SDA pullup"),
  ).toHaveLength(0)
})

test("trusts named symbols without consulting a symbol library", () => {
  expect(checkSymbol("external_library_symbol")).toHaveLength(0)
  expect(checkSymbol("boxresistor_down", "R_ENC_SDA", "")).toHaveLength(0)
  expect(checkSymbol("boxresistor_down", "unnamed_resistor1")).toHaveLength(0)
})

test("still checks components without a named symbol", () => {
  expect(checkSymbol("")).toHaveLength(1)
})
