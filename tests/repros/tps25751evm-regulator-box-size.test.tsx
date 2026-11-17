import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { runAllSchematicChecks } from "../.."
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"

// U8, C49 and C43 from the TPS25751EVM fixture in #578, unchanged.
// TI SLVUCP9B, figure 5-7: https://www.ti.com/lit/ug/slvucp9b/slvucp9b.pdf
test("checks TI TPS25751EVM regulator box sizing", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board schLayout={{ layoutMode: "none" }}>
      <net name="GND" />
      <net name="TIVA_5V" />
      <net name="TIVA_P3V3" />
      <chip
        name="U8"
        schX={-4.49921}
        schY={-3.90722}
        pinLabels={{
          pin1: "OUT",
          pin2: "GND",
          pin5: "PAD",
          pin3: "EN",
          pin4: "IN",
        }}
        schPinArrangement={{
          leftSide: { pins: ["pin4", "pin3"], direction: "top-to-bottom" },
          rightSide: {
            pins: ["pin2", "pin5", "pin1"],
            direction: "bottom-to-top",
          },
        }}
        schPinStyle={{
          pin4: { topMargin: 0 },
          pin3: { topMargin: 1.40067, bottomMargin: 0.80037 },
          pin2: { bottomMargin: 0 },
          pin5: { bottomMargin: 0.60037 },
          pin1: { bottomMargin: 1.40067, topMargin: 0 },
        }}
        schWidth={4.79903}
        schHeight={4.00179}
        pinAttributes={{
          pin1: {
            providesPower: true,
            providesVoltage: "3.3V",
            shouldHaveDecouplingCapacitor: true,
          },
          pin2: { requiresGround: true },
          pin3: { isInput: true },
          pin4: { requiresPower: true, shouldHaveDecouplingCapacitor: true },
          pin5: { requiresGround: true },
        }}
        manufacturerPartNumber="TLV75533PDQNT"
      />
      <capacitor
        name="C49"
        schX={-8.49854}
        schY={-5.30784}
        capacitance="1uF"
        schRotation={270}
        manufacturerPartNumber="C1005X6S1C105K050BC"
      />
      <capacitor
        name="C43"
        schX={1.49978}
        schY={-4.50747}
        capacitance="1uF"
        schRotation={270}
        manufacturerPartNumber="C1005X6S1C105K050BC"
      />
      <trace from="C49.pin2" to="net.GND" />
      <trace from="U8.pin3" to="net.TIVA_5V" />
      <trace from="U8.pin4" to="net.TIVA_5V" />
      <trace from="C49.pin1" to="net.TIVA_5V" />
      <trace from="U8.pin2" to="net.GND" />
      <trace from="U8.pin5" to="net.GND" />
      <trace from="C43.pin2" to="net.GND" />
      <trace from="U8.pin1" to="net.TIVA_P3V3" />
      <trace from="C43.pin1" to="net.TIVA_P3V3" />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = normalizeFixtureSourcePorts(circuit.getCircuitJson())
  const warnings = await runAllSchematicChecks(circuitJson)
  expect(warnings).toHaveLength(2)
  expect(warnings).toMatchObject([
    {
      type: "schematic_component_styling_warning",
      styling_issue_type: "schematic_box_too_wide",
    },
    {
      type: "schematic_component_styling_warning",
      styling_issue_type: "schematic_pin_padding_to_edge_too_large",
    },
  ])
  expect(
    convertCircuitJsonToSchematicSvg([...circuitJson, ...warnings], {
      width: 1200,
      height: 700,
      shouldDrawWarnings: true,
      includeVersion: false,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
