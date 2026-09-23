import { expect, test } from "bun:test"
import type { CircuitJson } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkEachPcbTraceNonOverlapping } from "../../lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { runAllRoutingChecks } from "../../lib/run-all-checks"

test("a pill hole aborts routing checks instead of returning a different-net crossing", async () => {
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
  expect(() =>
    checkEachPcbTraceNonOverlapping(structuredClone(circuitJson)),
  ).toThrow("Could not determine radius of element:")
  await expect(
    runAllRoutingChecks(structuredClone(circuitJson)),
  ).rejects.toThrow("Could not determine radius of element:")

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
  expect(await runAllRoutingChecks(withoutSlot)).toEqual(
    expect.arrayContaining(errors),
  )

  // Overlay the control's real DRC finding; the original check throws instead.
  expect(
    convertCircuitJsonToPcbSvg(
      [
        ...circuitJson,
        ...errors,
        {
          type: "pcb_note_text",
          pcb_note_text_id: "drc-control-caption",
          font: "tscircuit2024",
          font_size: 0.22,
          text: "With slot: DRC crashes. Marker: slot-removed control.",
          anchor_position: { x: 0, y: -2.6 },
          anchor_alignment: "center",
          layer: "top",
        },
      ],
      {
        shouldDrawErrors: true,
        showErrorsInTextOverlay: true,
        showPcbNotes: true,
      },
    ),
  ).toMatchSvgSnapshot(import.meta.path)
})
