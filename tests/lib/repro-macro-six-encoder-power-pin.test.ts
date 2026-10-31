import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import encoderSchematic from "../assets/macro-six-encoder-schematic.json"
import { checkNoPowerPinDefined } from "lib/check-no-power-pin-defined"

// Reduced from ENC1 in https://tscircuit.com/gokul/macro-six-usbc (open-assembly.tsx).
// EC11E18244AU is a passive mechanical encoder with a push switch, not a powered IC.
// Preserve the exported pin roles; omit unrelated PCB/CAD geometry and connectivity.
// The schematic fixture retains ENC1’s exported symbol, ports and labels.
test("repro: macro-six passive encoder receives a power-pin warning", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "source_component_36",
      ftype: "simple_chip",
      name: "ENC1",
      manufacturer_part_number: "EC11E18244AU",
    },
    {
      type: "source_port",
      source_port_id: "source_port_145",
      name: "pin6",
      pin_number: 6,
      source_component_id: "source_component_36",
      is_passive: true,
    },
    {
      type: "source_port",
      source_port_id: "source_port_146",
      name: "pin7",
      pin_number: 7,
      source_component_id: "source_component_36",
      is_passive: true,
    },
    {
      type: "source_port",
      source_port_id: "source_port_147",
      name: "A",
      pin_number: 8,
      source_component_id: "source_component_36",
      is_passive: true,
    },
    {
      type: "source_port",
      source_port_id: "source_port_148",
      name: "C",
      pin_number: 9,
      source_component_id: "source_component_36",
      is_passive: true,
      requires_ground: true,
    },
    {
      type: "source_port",
      source_port_id: "source_port_149",
      name: "B",
      pin_number: 10,
      source_component_id: "source_component_36",
      is_passive: true,
    },
    {
      type: "source_port",
      source_port_id: "source_port_150",
      name: "D",
      pin_number: 11,
      source_component_id: "source_component_36",
      is_passive: true,
    },
    {
      type: "source_port",
      source_port_id: "source_port_151",
      name: "E",
      pin_number: 12,
      source_component_id: "source_component_36",
      is_passive: true,
      requires_ground: true,
    },
  ]

  // Capture the current false positive. The expected corrected result is [].
  // Related fix: https://github.com/tscircuit/checks/pull/477
  const warnings = checkNoPowerPinDefined(circuitJson)
  expect(warnings.map((warning) => warning.message)).toMatchInlineSnapshot(`
      [
        "ENC1 has no pin with requires_power=true",
      ]
    `)

  const annotatedCircuitJson: AnyCircuitElement[] = [
    ...circuitJson,
    ...(encoderSchematic as AnyCircuitElement[]),
    {
      type: "schematic_text",
      schematic_text_id: "passive_pin_annotation",
      text: "All seven ENC1 pins are marked passive; no supply pin is required.",
      color: "#006464",
      position: { x: -10.75, y: 2.9 },
      anchor: "center",
      rotation: 0,
      font_size: 0.16,
    },
    ...warnings.map(
      (warning): AnyCircuitElement => ({
        type: "schematic_text",
        schematic_text_id: "power_warning_annotation",
        text: warning.message,
        position: { x: -10.75, y: 2.5 },
        anchor: "center",
        rotation: 0,
        font_size: 0.16,
        color: "red",
      }),
    ),
  ]
  expect(
    convertCircuitJsonToSchematicSvg(annotatedCircuitJson),
  ).toMatchSvgSnapshot(import.meta.path)
}, 20_000)
