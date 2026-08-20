import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPushButtonInternalConnections } from "lib/check-push-button-internal-connections"
import { runAllNetlistChecks } from "lib/run-all-checks"

const createPushButtonCircuitJson = (
  internallyConnectedSourcePortIds?: string[][],
): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "source_component_sw1",
    name: "SW1",
    ftype: "simple_push_button",
    internally_connected_source_port_ids: internallyConnectedSourcePortIds,
  },
  ...[1, 2, 3, 4].map(
    (pinNumber): AnyCircuitElement => ({
      type: "source_port",
      source_port_id: `source_port_sw1_${pinNumber}`,
      source_component_id: "source_component_sw1",
      name: `pin${pinNumber}`,
      pin_number: pinNumber,
      port_hints: [`pin${pinNumber}`],
    }),
  ),
]

test("errors when a four-pin pushbutton omits internal connection pairs", async () => {
  const circuitJson = createPushButtonCircuitJson()

  expect(checkPushButtonInternalConnections(circuitJson)).toEqual([
    expect.objectContaining({
      type: "source_component_misconfigured_error",
      source_component_ids: ["source_component_sw1"],
    }),
  ])
  expect(await runAllNetlistChecks(circuitJson)).toEqual(
    expect.arrayContaining(checkPushButtonInternalConnections(circuitJson)),
  )
})

test("accepts a four-pin pushbutton with two complete internal pairs", () => {
  const circuitJson = createPushButtonCircuitJson([
    ["source_port_sw1_1", "source_port_sw1_2"],
    ["source_port_sw1_3", "source_port_sw1_4"],
  ])

  expect(checkPushButtonInternalConnections(circuitJson)).toEqual([])
})
