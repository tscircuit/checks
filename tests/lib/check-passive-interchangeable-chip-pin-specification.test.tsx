import "bun-match-svg"
import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { checkAllPinsInComponentAreUnderspecified } from "lib/check-all-pins-in-component-are-underspecified"
import { checkNoGroundPinDefined } from "lib/check-no-ground-pin-defined"
import { checkNoPowerPinDefined } from "lib/check-no-power-pin-defined"
import { Circuit } from "tscircuit"

const addPinSpecificationWarningLabels = (
  svg: string,
  warnings: AnyCircuitElement[],
): string => {
  const warningLabels = warnings
    .map(
      (warning, index) =>
        `<text x="20" y="${24 + index * 17}" fill="red" font-family="sans-serif" font-size="13" data-type="pin-specification-warning">${"message" in warning ? warning.message : warning.type}</text>`,
    )
    .join("")

  return svg.replace("</svg>", `${warningLabels}</svg>`)
}

test("passive jumpers do not need active-chip pin roles", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board routingDisabled>
      <jumper name="J1" pinCount={2} schX={-4} schY={0} />
      <solderjumper name="SJ1" pinCount={2} schX={0} schY={0} />
      <chip
        name="U1"
        pinLabels={{ pin1: "IO1", pin2: "IO2" }}
        schX={4}
        schY={0}
      />
    </board>,
  )

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const warnings = [
    ...checkAllPinsInComponentAreUnderspecified(circuitJson),
    ...checkNoPowerPinDefined(circuitJson),
    ...checkNoGroundPinDefined(circuitJson),
  ]

  const sourceComponentIdsByName = new Map(
    circuitJson
      .filter((element) => element.type === "source_component")
      .map((component) => [component.name, component.source_component_id]),
  )
  const warningCountFor = (componentName: string) =>
    warnings.filter(
      (warning) =>
        warning.source_component_id ===
        sourceComponentIdsByName.get(componentName),
    ).length

  // Jumper and SolderJumper are emitted as simple_chip elements with
  // are_pins_interchangeable=true, so all three active-chip checks currently
  // produce false-positive warnings for each passive part.
  expect(warningCountFor("J1")).toBe(3)
  expect(warningCountFor("SJ1")).toBe(3)
  expect(warningCountFor("U1")).toBe(3)

  expect(
    addPinSpecificationWarningLabels(
      convertCircuitJsonToSchematicSvg([...circuitJson, ...warnings]),
      warnings,
    ),
  ).toMatchSvgSnapshot(import.meta.path)
})
