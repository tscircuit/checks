import { expect, test } from "bun:test"
import type { AnyCircuitElement, SourcePort } from "circuit-json"
import { checkNoGroundPinDefined } from "lib/check-no-ground-pin-defined"
import { checkNoPowerPinDefined } from "lib/check-no-power-pin-defined"

test.each([
  { name: "Q_BUZZER", pinNames: ["G", "S", "D"], warningCount: 0 },
  {
    name: "Q_PD_ENABLE",
    pinNames: ["pin1", "pin2", "pin3"],
    portHints: [["Gate"], ["Source"], ["Drain"]],
    warningCount: 0,
  },
  { name: "Q1", pinNames: ["G", "S", "VDD"], warningCount: 1 },
  { name: "Q2", pinNames: ["G", "S", "D", "VDD"], warningCount: 1 },
  { name: "U1", pinNames: ["G", "S", "D"], warningCount: 1 },
  {
    name: "Q_SHARED_ALIASES",
    pinNames: ["pin1", "pin2", "pin3"],
    portHints: [["G", "S"], ["D"], []],
    warningCount: 1,
  },
])(
  "reports $warningCount missing-pin warnings per role for $name",
  ({ name, pinNames, portHints, warningCount }) => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "component_1",
        name,
        ftype: "simple_chip",
      },
      ...pinNames.map(
        (pinName, index): SourcePort => ({
          type: "source_port",
          source_port_id: `port_${index}`,
          source_component_id: "component_1",
          name: pinName,
          port_hints: [...(portHints?.[index] ?? [])],
        }),
      ),
    ]

    expect(checkNoPowerPinDefined(circuitJson)).toHaveLength(warningCount)
    expect(checkNoGroundPinDefined(circuitJson)).toHaveLength(warningCount)
  },
)
