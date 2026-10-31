import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { checkNoPowerPinDefined } from "lib/check-no-power-pin-defined"
import { Circuit } from "tscircuit"
import { createElement } from "react"

// Reduced from lib/controls.tsx and imports/EC11E18244AU.tsx in
// https://tscircuit.com/gokul/macro-six-usbc (open-assembly.tsx).
// Keep the encoder's pin labels and passive/ground roles; omit PCB/CAD geometry.
const MacroSixEncoder = ({ warning }: { warning?: string }) =>
  createElement(
    "board",
    null,
    createElement("chip", {
      name: "ENC1",
      manufacturerPartNumber: "EC11E18244AU",
      pinLabels: {
        pin6: ["pin6"],
        pin7: ["pin7"],
        pin8: ["A"],
        pin9: ["C"],
        pin10: ["B"],
        pin11: ["D"],
        pin12: ["E"],
      },
      pinAttributes: {
        pin6: { isPassive: true },
        pin7: { isPassive: true },
        A: { isPassive: true },
        C: { isPassive: true, requiresGround: true },
        B: { isPassive: true },
        D: { isPassive: true },
        E: { isPassive: true, requiresGround: true },
      },
    }),
    createElement("schematictext", {
      text: "All seven ENC1 pins are marked passive; no supply pin is required.",
      schY: -1.5,
      fontSize: 0.16,
      color: "#006464",
    }),
    warning &&
      createElement("schematictext", {
        text: warning,
        schY: -1.9,
        fontSize: 0.16,
        color: "red",
      }),
  )

test("repro: macro-six passive encoder receives a power-pin warning", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(createElement(MacroSixEncoder, {}))
  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const ports = circuitJson.filter((element) => element.type === "source_port")
  expect(ports).toHaveLength(7)
  expect(ports.every((port) => port.is_passive === true)).toBe(true)

  // Capture the current false positive. The expected corrected result is [].
  // Related fix: https://github.com/tscircuit/checks/pull/477
  const warnings = checkNoPowerPinDefined(circuitJson)
  expect(warnings.map((warning) => warning.message)).toMatchInlineSnapshot(`
    [
      "ENC1 has no pin with requires_power=true",
    ]
  `)

  const annotatedCircuit = new Circuit()
  annotatedCircuit.pcbDisabled = true
  annotatedCircuit.add(
    createElement(MacroSixEncoder, { warning: warnings[0]?.message }),
  )
  await annotatedCircuit.renderUntilSettled()
  expect(
    convertCircuitJsonToSchematicSvg(annotatedCircuit.getCircuitJson()).replace(
      /[ \t]+$/gm,
      "",
    ),
  ).toMatchSvgSnapshot(import.meta.path)
}, 20_000)
