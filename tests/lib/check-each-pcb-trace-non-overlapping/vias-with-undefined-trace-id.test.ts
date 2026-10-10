import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"

test("live footprint vias retain net ownership when pcb_trace_id is explicitly undefined", () => {
  const circuit: AnyCircuitElement[] = [
    {
      type: "source_net",
      source_net_id: "gnd",
      name: "GND",
      member_source_group_ids: [],
    },
    {
      type: "source_net",
      source_net_id: "vbus",
      name: "VBUS",
      member_source_group_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "ground_trace",
      connected_source_port_ids: [],
      connected_source_net_ids: ["gnd"],
    },
    {
      type: "source_trace",
      source_trace_id: "power_trace",
      connected_source_port_ids: [],
      connected_source_net_ids: ["vbus"],
    },
    ...[
      { x: 5, y: 0 },
      { x: 0, y: 5 },
      { x: -5, y: -5 },
    ].map((endpoint, branch) => ({
      type: "pcb_trace" as const,
      pcb_trace_id: `ground_branch_${branch}`,
      source_trace_id: "ground_trace",
      route: [
        {
          route_type: "wire" as const,
          x: 0,
          y: 0,
          width: 0.2,
          layer: "top" as const,
        },
        {
          route_type: "wire" as const,
          ...endpoint,
          width: 0.2,
          layer: "top" as const,
        },
      ],
    })),
    ...[-1, 0, 1].flatMap((x) =>
      [-1, 0, 1].map((y) => ({
        type: "pcb_via" as const,
        pcb_via_id: `thermal_via_${x}_${y}`,
        pcb_trace_id: undefined,
        source_trace_id: "ground_trace",
        x,
        y,
        hole_diameter: 0.3,
        outer_diameter: 0.6,
        layers: ["top" as const, "bottom" as const],
      })),
    ),
    {
      type: "pcb_via",
      pcb_via_id: "foreign_via",
      pcb_trace_id: undefined,
      source_trace_id: "power_trace",
      x: 3.5,
      y: 0,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      layers: ["top", "bottom"],
    },
  ]

  const liveErrors = checkEachPcbTraceNonOverlapping(circuit)
  const serializedErrors = checkEachPcbTraceNonOverlapping(
    JSON.parse(JSON.stringify(circuit)),
  )

  expect(liveErrors).toEqual(serializedErrors)
  expect(liveErrors).toHaveLength(1)
  const foreignContact = liveErrors[0]!
  if (foreignContact.type !== "pcb_trace_error") {
    throw new Error("Expected a foreign-net via contact")
  }
  expect(foreignContact.pcb_trace_error_id).toBe(
    "overlap_ground_branch_0_foreign_via",
  )
  expect(foreignContact.message).toContain('pcb_via "unnamed via"')
})
