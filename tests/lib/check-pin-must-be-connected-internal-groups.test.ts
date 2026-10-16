import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPinMustBeConnected } from "lib/check-pin-must-be-connected"

function createConnectedPins({
  componentGroups = [],
  connectionGroups = [],
  includeTrace = true,
}: {
  componentGroups?: ReadonlyArray<ReadonlyArray<string>>
  connectionGroups?: ReadonlyArray<ReadonlyArray<string>>
  includeTrace?: boolean
}): AnyCircuitElement[] {
  return [
    {
      type: "source_component",
      source_component_id: "chip",
      ftype: "simple_chip",
      name: "U1",
      internally_connected_source_port_ids: componentGroups.map((group) => [
        ...group,
      ]),
    },
    ...["a", "b", "c", "isolated"].map(
      (name): AnyCircuitElement => ({
        type: "source_port",
        source_port_id: name,
        source_component_id: "chip",
        name,
        must_be_connected: name === "a" || name === "isolated",
      }),
    ),
    ...connectionGroups.map(
      (source_port_ids, index): AnyCircuitElement => ({
        type: "source_component_internal_connection",
        source_component_internal_connection_id: `connection_${index}`,
        source_component_id: "chip",
        source_port_ids: [...source_port_ids],
      }),
    ),
    ...(includeTrace
      ? [
          {
            type: "source_trace" as const,
            source_trace_id: "trace",
            connected_source_port_ids: ["c"],
            connected_source_net_ids: ["ground"],
          },
          {
            type: "source_net" as const,
            source_net_id: "ground",
            name: "GND",
            member_source_group_ids: [],
          },
        ]
      : []),
  ]
}

describe("required pins connected through internal groups", () => {
  test.each([
    {
      componentGroups: [
        ["a", "b"],
        ["b", "c"],
      ],
    },
    {
      componentGroups: [
        ["b", "c"],
        ["a", "b"],
      ],
    },
    {
      connectionGroups: [
        ["a", "b"],
        ["b", "c"],
      ],
    },
    {
      connectionGroups: [
        ["b", "c"],
        ["a", "b"],
      ],
    },
    {
      componentGroups: [["a", "b"]],
      connectionGroups: [["b", "c"]],
    },
  ])("follows the complete internal connection chain: %j", (groups) => {
    const errors = checkPinMustBeConnected(createConnectedPins(groups))

    expect(errors.map((error) => error.source_port_id)).toEqual(["isolated"])
  })

  test("an internal connection cycle alone does not satisfy a required pin", () => {
    const errors = checkPinMustBeConnected(
      createConnectedPins({
        componentGroups: [
          ["a", "b"],
          ["b", "c"],
          ["c", "a"],
        ],
        includeTrace: false,
      }),
    )

    expect(errors.map((error) => error.source_port_id)).toEqual([
      "a",
      "isolated",
    ])
  })

  test("duplicate and empty internal groups do not affect connectivity", () => {
    const errors = checkPinMustBeConnected(
      createConnectedPins({
        componentGroups: [[], ["b"], ["a", "b"], ["b", "c"], ["c", "a"]],
        connectionGroups: [["a", "b"]],
      }),
    )

    expect(errors.map((error) => error.source_port_id)).toEqual(["isolated"])
  })
})
