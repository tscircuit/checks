import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { checkSchematicComponentMissingReferenceDesignatorText } from "lib/check-schematic-component-missing-reference-designator-text"
import { Circuit } from "tscircuit"

// Watchy v1.2.12 motor symbol; the original reference placeholder is {NAME}.
const PagerMotorSymbol = ({ referenceText }: { referenceText?: string }) => (
  <symbol>
    {referenceText && (
      <schematictext
        text={referenceText}
        schX={0.2}
        schY={0.2}
        fontSize={0.1}
        anchor="left"
        color="rgb(132, 0, 0)"
      />
    )}
    <schematictext
      text="Vibration Motor"
      schX={0.2}
      schY={-0.4}
      fontSize={0.1}
      anchor="left"
      color="rgb(132, 0, 0)"
    />
    <schematiccircle
      center={{ x: 0, y: -0.12 }}
      radius={0.256}
      strokeWidth={0.02}
    />
    <schematicline
      x1={-0.1}
      y1={-0.26}
      x2={-0.1}
      y2={0.04}
      strokeWidth={0.045}
    />
    <schematicline x1={-0.1} y1={0.04} x2={0} y2={-0.16} strokeWidth={0.045} />
    <schematicline x1={0} y1={-0.16} x2={0.1} y2={0.04} strokeWidth={0.045} />
    <schematicline x1={0.1} y1={0.04} x2={0.1} y2={-0.26} strokeWidth={0.045} />
    <schematicline x1={0} y1={0.136} x2={0} y2={0.2} strokeWidth={0.045} />
    <schematicline x1={0} y1={-0.376} x2={0} y2={-0.4} strokeWidth={0.045} />
    <port
      name="pin1"
      pinNumber={1}
      schX={0}
      schY={0.4}
      direction="up"
      schStemLength={0.2}
    />
    <port
      name="pin2"
      pinNumber={2}
      schX={0}
      schY={-0.6}
      direction="down"
      schStemLength={0.2}
    />
  </symbol>
)

const MotorDriverCircuit = ({ referenceText }: { referenceText?: string }) => (
  <board>
    <chip
      name="M1"
      symbol={<PagerMotorSymbol referenceText={referenceText} />}
      schX={0}
      schY={2}
    />
    <transistor
      name="Q2"
      manufacturerPartNumber="S8050"
      type="npn"
      schX={-0.29}
      schY={-1}
      schRotation={270}
    />
    <diode
      name="D2"
      manufacturerPartNumber="1N4001"
      pinLabels={{
        pin1: ["pin1", "1", "cathode", "neg"],
        pin2: ["pin2", "2", "anode", "pos"],
      }}
      schX={-2}
      schY={2}
      schRotation={90}
    />
    <resistor
      name="R13"
      resistance="1kΩ"
      schX={-2}
      schY={-1}
      schRotation={180}
    />
    <capacitor
      name="C14"
      capacitance="100nF"
      schX={2}
      schY={2}
      schRotation={270}
    />
    <trace from="M1.pin1" to="D2.pin1" />
    <trace from="M1.pin1" to="C14.pin1" />
    <trace from="M1.pin1" to="net.P3V3" />
    <trace from="M1.pin2" to="D2.pin2" />
    <trace from="M1.pin2" to="C14.pin2" />
    <trace from="M1.pin2" to="Q2.collector" />
    <trace from="R13.pin1" to="Q2.base" />
    <trace from="R13.pin2" to="net.VIB_PWM" />
    <trace from="Q2.emitter" to="net.GND" />
  </board>
)

test("Watchy motor M1 renders REFDES literally and keeps the missing-reference warning", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(<MotorDriverCircuit referenceText="{REFDES}" />)
  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const sourceComponents = circuitJson.filter(
    (element) => element.type === "source_component",
  )
  const motor = sourceComponents.find(
    (sourceComponent) => sourceComponent.name === "M1",
  )!
  expect(
    sourceComponents.map((sourceComponent) => sourceComponent.name).sort(),
  ).toEqual(["C14", "D2", "M1", "Q2", "R13"])
  const sourcePorts = circuitJson.filter(
    (element) => element.type === "source_port",
  )
  for (const expectedPins of [
    ["C14.pin1", "D2.pin1", "M1.pin1"],
    ["C14.pin2", "D2.pin2", "M1.pin2", "Q2.pin1"],
    ["Q2.pin2", "R13.pin1"],
    ["R13.pin2"],
    ["Q2.pin3"],
  ]) {
    const connectedPins = sourcePorts.map((port) => {
      const owner = sourceComponents.find(
        (sourceComponent) =>
          sourceComponent.source_component_id === port.source_component_id,
      )!
      return {
        name: `${owner.name}.${port.name}`,
        connectivityKey: port.subcircuit_connectivity_map_key,
      }
    })
    const anchor = connectedPins.find((pin) => pin.name === expectedPins[0])!
    expect(
      connectedPins
        .filter((pin) => pin.connectivityKey === anchor.connectivityKey)
        .map((pin) => pin.name)
        .sort(),
    ).toEqual(expectedPins)
  }
  const symbolTexts = circuitJson.flatMap((element) =>
    element.type === "schematic_text" && element.schematic_symbol_id
      ? [element.text]
      : [],
  )
  expect(symbolTexts).toEqual(["{REFDES}", "Vibration Motor"])
  const warnings =
    checkSchematicComponentMissingReferenceDesignatorText(circuitJson)
  expect(warnings).toMatchObject([
    {
      source_component_id: motor.source_component_id,
      styling_issue_type: "missing_reference_designator_text",
      message:
        'M1 is missing schematic reference designator text. For a custom symbol, add name="{REFDES}" inside the symbol.',
    },
  ])
  for (const referenceText of [undefined, "{REF}", "{NAME}"]) {
    const referenceCircuit = new Circuit()
    referenceCircuit.pcbDisabled = true
    referenceCircuit.add(<MotorDriverCircuit referenceText={referenceText} />)
    await referenceCircuit.renderUntilSettled()
    const referenceCircuitJson = referenceCircuit.getCircuitJson()
    expect(
      checkSchematicComponentMissingReferenceDesignatorText(
        referenceCircuitJson,
      ),
    ).toHaveLength(referenceText ? 0 : 1)
    if (referenceText) {
      expect(
        referenceCircuitJson.some(
          (element) =>
            element.type === "schematic_text" &&
            element.schematic_symbol_id &&
            element.text === "M1",
        ),
      ).toBe(true)
    }
  }
  await expect(
    convertCircuitJsonToSchematicSvg([...circuitJson, ...warnings]).replace(
      /[ \t]+$/gm,
      "",
    ),
  ).toMatchSvgSnapshot(import.meta.path)
})
