import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkViaTraceClearance } from "lib/check-via-trace-clearance"

type Layer = "top" | "bottom"

const wire = (x: number, y: number, width: number, layer: Layer) => ({
  route_type: "wire" as const,
  x,
  y,
  width,
  layer,
})

const note = (
  id: string,
  text: string,
  x: number,
  y: number,
  color: string,
) => ({
  type: "pcb_note_text" as const,
  pcb_note_text_id: id,
  text,
  anchor_position: { x, y },
  anchor_alignment: "center" as const,
  font: "tscircuit2024" as const,
  font_size: 0.16,
  layer: "top" as const,
  color,
})

// Original coordinates translated so the Gerber marker is at (0, 0).
const via = { x: -0.195995, y: -0.220005 }

const circuitJson = [
  {
    type: "source_trace",
    source_trace_id: "source_trace_vbus",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
  },
  {
    type: "source_trace",
    source_trace_id: "source_trace_3v3",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
  },
  {
    type: "pcb_board",
    pcb_board_id: "pcb_board_repro",
    center: { x: 0, y: 0 },
    width: 6,
    height: 4,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_vbus",
    source_trace_id: "source_trace_vbus",
    route: [
      wire(0.374302, 0.010698, 0.55, "top"),
      wire(0.002192, 0.382897, 0.55, "top"),
    ],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_3v3",
    source_trace_id: "source_trace_3v3",
    route: [
      wire(-0.762663, -0.253003, 0.375, "top"),
      wire(via.x, via.y, 0.375, "top"),
      {
        route_type: "via",
        ...via,
        from_layer: "top",
        to_layer: "bottom",
      },
      wire(via.x, via.y, 0.6, "bottom"),
      wire(0.10101, 0.077, 0.6, "bottom"),
      wire(0.958, 0.077, 0.6, "bottom"),
    ],
  },
  {
    type: "pcb_via",
    pcb_via_id: "pcb_via_3v3",
    pcb_trace_id: "pcb_trace_3v3",
    ...via,
    hole_diameter: 0.2,
    outer_diameter: 0.3,
    layers: ["top", "bottom"],
    from_layer: "top",
    to_layer: "bottom",
  },
] satisfies AnyCircuitElement[]

test("reproduces Gerber short disagreement on two nets", () => {
  const drcErrors = [
    ...checkEachPcbTraceNonOverlapping(circuitJson),
    ...checkViaTraceClearance(circuitJson),
  ]

  const notes = [
    note("note_vbus", "VBUS: 0.55mm top trace", 1.65, 0.85, "#ef4444"),
    note("note_3v3", "3V3: 0.30mm via", -1.7, -0.75, "#60a5fa"),
    note(
      "note_marker",
      "Gerber checker reports short here",
      0,
      1.55,
      "#fbbf24",
    ),
    note(
      "note_result",
      `copper gap: 0.141mm; minimum: 0.100mm; DRC errors: ${drcErrors.length}`,
      0,
      -1.55,
      "#a78bfa",
    ),
    {
      type: "pcb_note_path",
      pcb_note_path_id: "note_marker_arrow",
      route: [
        { x: 0, y: 1.3 },
        { x: -0.25, y: 0.4 },
        { x: 0, y: 0 },
      ],
      stroke_width: 0.05,
      layer: "top",
      color: "#fbbf24",
    },
    {
      type: "pcb_note_rect",
      pcb_note_rect_id: "note_marker_box",
      center: { x: 0, y: 0 },
      width: 0.3,
      height: 0.3,
      stroke_width: 0.05,
      is_filled: false,
      has_stroke: true,
      layer: "top",
      color: "#fbbf24",
    },
  ] satisfies AnyCircuitElement[]

  expect(drcErrors).toHaveLength(0)
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...notes, ...drcErrors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
