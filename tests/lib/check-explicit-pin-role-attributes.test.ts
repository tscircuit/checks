import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement, SourcePinAttributes } from "circuit-json"
import { checkAllPinsInComponentAreUnderspecified } from "lib/check-all-pins-in-component-are-underspecified"

const roleAttributes = [
  "is_passive",
  "is_input",
  "is_output",
  "is_bidirectional",
] as const satisfies readonly (keyof SourcePinAttributes)[]

describe("explicit pin role attributes", () => {
  for (const attribute of roleAttributes) {
    for (const value of [true, false, undefined]) {
      test(`${attribute}=${value} ${value === undefined ? "remains underspecified" : "counts as specified"}`, () => {
        const circuitJson: AnyCircuitElement[] = [
          {
            type: "source_component",
            source_component_id: "component_1",
            name: "U1",
            ftype: "simple_chip",
          },
          {
            type: "source_port",
            source_port_id: "port_1",
            source_component_id: "component_1",
            name: "IO1",
          },
          {
            type: "source_port",
            source_port_id: "port_2",
            source_component_id: "component_1",
            name: "IO2",
            [attribute]: value,
          },
          {
            type: "source_component",
            source_component_id: "component_2",
            name: "U2",
            ftype: "simple_chip",
          },
          {
            type: "source_port",
            source_port_id: "port_3",
            source_component_id: "component_2",
            name: "IO1",
          },
        ]
        const original = structuredClone(circuitJson)
        const warnings = checkAllPinsInComponentAreUnderspecified(circuitJson)

        expect(warnings.map((warning) => warning.source_component_id)).toEqual(
          value === undefined
            ? ["component_1", "component_2"]
            : ["component_2"],
        )
        expect(circuitJson).toEqual(original)
      })
    }
  }
})
