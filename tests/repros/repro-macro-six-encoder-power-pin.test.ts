import { expect, test } from "bun:test"
import { checkNoPowerPinDefined } from "lib/check-no-power-pin-defined"
import { Circuit } from "tscircuit"
import { createElement } from "react"

// Reduced from lib/controls.tsx and imports/EC11E18244AU.tsx in
// https://tscircuit.com/gokul/macro-six-usbc (open-assembly.tsx).
// Keep the encoder's pin labels, passive/ground roles and net connections; omit PCB/CAD geometry.
const MacroSixEncoder = () =>
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
      connections: {
        A: "net.ENC_A",
        B: "net.ENC_B",
        C: "net.GND",
        D: "net.ENC_PUSH",
        E: "net.GND",
        pin6: "net.GND",
        pin7: "net.GND",
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

  const traces = circuitJson.filter(
    (element) => element.type === "source_trace",
  )
  expect(
    ports.every((port) =>
      traces.some((trace) =>
        trace.connected_source_port_ids.includes(port.source_port_id),
      ),
    ),
  ).toBe(true)

  // Capture the current false positive. The expected corrected result is [].
  // Related fix: https://github.com/tscircuit/checks/pull/477
  const warnings = checkNoPowerPinDefined(circuitJson)
  expect(warnings.map((warning) => warning.message)).toMatchInlineSnapshot(`
    [
      "ENC1 has no pin with requires_power=true",
    ]
  `)
})
