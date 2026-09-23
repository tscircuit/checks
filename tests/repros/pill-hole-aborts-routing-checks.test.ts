import { expect, test } from "bun:test"
import type { CircuitJson } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkEachPcbTraceNonOverlapping } from "../../lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { runAllRoutingChecks } from "../../lib/run-all-checks"

test("routing checks report a different-net crossing beside a pill hole", async () => {
  const circuitJson: CircuitJson = [
    {
      type: "pcb_board",
      pcb_board_id: "board",
      center: { x: 0, y: 0 },
      width: 10,
      height: 6,
      num_layers: 2,
      thickness: 1.6,
      material: "fr4",
    },
    {
      type: "source_net",
      source_net_id: "net_a",
      name: "A",
      member_source_group_ids: [],
    },
    {
      type: "source_net",
      source_net_id: "net_b",
      name: "B",
      member_source_group_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_a",
      connected_source_port_ids: [],
      connected_source_net_ids: ["net_a"],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_b",
      connected_source_port_ids: [],
      connected_source_net_ids: ["net_b"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_a",
      source_trace_id: "source_trace_a",
      route: [
        { route_type: "wire", x: -4, y: -2, width: 0.2, layer: "bottom" },
        { route_type: "wire", x: 4, y: 2, width: 0.2, layer: "bottom" },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_b",
      source_trace_id: "source_trace_b",
      route: [
        { route_type: "wire", x: -4, y: 2, width: 0.2, layer: "bottom" },
        { route_type: "wire", x: 4, y: -2, width: 0.2, layer: "bottom" },
      ],
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "slot",
      hole_shape: "pill",
      hole_width: 1,
      hole_height: 0.5,
      x: 2,
      y: 0,
    },
  ]

  // The slot is clear of both traces, but inside their spatial search bounds.
  const errorsWithSlot = checkEachPcbTraceNonOverlapping(
    structuredClone(circuitJson),
  )

  // Diagnostic control only: remove the hole, keeping every copper element.
  const withoutSlot = circuitJson.filter(
    (element) => element.type !== "pcb_hole",
  )
  const errors = checkEachPcbTraceNonOverlapping(structuredClone(withoutSlot))
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_trace_error",
    pcb_trace_error_id: "overlap_trace_a_trace_b",
    center: { x: 0, y: 0 },
  })
  expect(errors[0].message).toContain("(accidental contact)")
  expect(errorsWithSlot).toEqual(errors)
  expect(await runAllRoutingChecks(structuredClone(circuitJson))).toEqual(
    expect.arrayContaining(errors),
  )
  expect(await runAllRoutingChecks(withoutSlot)).toEqual(
    expect.arrayContaining(errors),
  )

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errorsWithSlot], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
