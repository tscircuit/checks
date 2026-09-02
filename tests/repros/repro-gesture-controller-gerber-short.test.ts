import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkViaTraceClearance } from "lib/check-via-trace-clearance"

const SHORT_MARKER = { x: 4.042, y: -11.077 }

// Reduced from the 0.6 mm gesture-controller autoroute. `tsci check shorts`
// marked VBUS <-> V3V3 here while the vector routing checks returned no error.
const routedCopper = [
  {
    type: "source_net",
    source_net_id: "source_net_vbus",
    name: "VBUS",
    member_source_group_ids: [],
    is_power: true,
  },
  {
    type: "source_net",
    source_net_id: "source_net_3v3",
    name: "V3V3",
    member_source_group_ids: [],
    is_power: true,
  },
  {
    type: "source_trace",
    source_trace_id: "source_trace_vbus",
    connected_source_port_ids: [],
    connected_source_net_ids: ["source_net_vbus"],
  },
  {
    type: "source_trace",
    source_trace_id: "source_trace_3v3",
    connected_source_port_ids: [],
    connected_source_net_ids: ["source_net_3v3"],
  },
  {
    type: "pcb_board",
    pcb_board_id: "pcb_board_gesture_controller_short",
    center: { x: 4, y: -11.15 },
    width: 6,
    height: 4.3,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "source_net_0_mst4_0",
    source_trace_id: "source_trace_vbus",
    route: [
      {
        route_type: "wire",
        x: 4.114206538257552,
        y: -11.99386934904799,
        width: 0.6,
        layer: "top",
      },
      {
        route_type: "wire",
        x: 4.158800472238432,
        y: -11.99386934904799,
        width: 0.6,
        layer: "top",
      },
      {
        route_type: "wire",
        x: 4.539505089577328,
        y: -11.613164731709094,
        width: 0.575,
        layer: "top",
      },
      {
        route_type: "wire",
        x: 4.4163017865631815,
        y: -11.06630178656318,
        width: 0.55,
        layer: "top",
      },
      {
        route_type: "wire",
        x: 4.044191857708787,
        y: -10.694103191042121,
        width: 0.55,
        layer: "top",
      },
      {
        route_type: "wire",
        x: 3.6720819288543938,
        y: -10.32190459552106,
        width: 0.6,
        layer: "top",
      },
      {
        route_type: "wire",
        x: 3.299972,
        y: -9.949706,
        width: 0.6,
        layer: "top",
      },
    ],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "source_net_1_mst11_0",
    source_trace_id: "source_trace_3v3",
    route: [
      {
        route_type: "wire",
        x: 5.675,
        y: -11,
        width: 0.375,
        layer: "top",
      },
      {
        route_type: "wire",
        x: 5,
        y: -11,
        width: 0.375,
        layer: "top",
      },
      {
        route_type: "via",
        x: 5,
        y: -11,
        from_layer: "top",
        to_layer: "bottom",
      },
      {
        route_type: "wire",
        x: 5,
        y: -11,
        width: 0.6,
        layer: "bottom",
      },
      {
        route_type: "wire",
        x: 4.143010101267768,
        y: -11,
        width: 0.6,
        layer: "bottom",
      },
      {
        route_type: "wire",
        x: 3.846005050633883,
        y: -11.297005050633885,
        width: 0.6,
        layer: "bottom",
      },
      {
        route_type: "via",
        x: 3.846005050633883,
        y: -11.297005050633885,
        from_layer: "bottom",
        to_layer: "top",
      },
      {
        route_type: "wire",
        x: 3.846005050633883,
        y: -11.297005050633885,
        width: 0.375,
        layer: "top",
      },
      {
        route_type: "wire",
        x: 3.2793367004225895,
        y: -11.330003367089256,
        width: 0.375,
        layer: "top",
      },
      {
        route_type: "wire",
        x: 2.9837598333333335,
        y: -11.0344265,
        width: 0.6,
        layer: "top",
      },
      {
        route_type: "wire",
        x: 1.7845070000000014,
        y: -11.0344265,
        width: 0.6,
        layer: "top",
      },
    ],
  },
  {
    type: "pcb_via",
    pcb_via_id: "pcb_via_28",
    pcb_trace_id: "source_net_1_mst11_0",
    x: 3.846005050633883,
    y: -11.297005050633885,
    hole_diameter: 0.2,
    outer_diameter: 0.3,
    layers: ["top", "bottom"],
    from_layer: "bottom",
    to_layer: "top",
  },
  {
    type: "pcb_via",
    pcb_via_id: "pcb_via_29",
    pcb_trace_id: "source_net_1_mst11_0",
    x: 5,
    y: -11,
    hole_diameter: 0.2,
    outer_diameter: 0.3,
    layers: ["top", "bottom"],
    from_layer: "top",
    to_layer: "bottom",
  },
] satisfies AnyCircuitElement[]

test("reproduces gesture controller gerber short missed by routing DRC", async () => {
  const drcErrors = [
    ...checkEachPcbTraceNonOverlapping(routedCopper),
    ...checkViaTraceClearance(routedCopper),
  ]
  const errorSummary = drcErrors.map((error) => error.message).join(" | ")

  const annotations = [
    {
      type: "pcb_note_text",
      pcb_note_text_id: "pcb_note_text_short_marker",
      text: "Gerber short marker: VBUS <-> V3V3",
      anchor_position: { x: 4.9, y: -9.55 },
      anchor_alignment: "center",
      font: "tscircuit2024",
      font_size: 0.18,
      layer: "top",
      color: "#fbbf24",
    },
    {
      type: "pcb_note_path",
      pcb_note_path_id: "pcb_note_path_short_marker",
      route: [{ x: 4.9, y: -9.8 }, { x: 4.6, y: -10.2 }, SHORT_MARKER],
      stroke_width: 0.08,
      layer: "top",
      color: "#fbbf24",
    },
    {
      type: "pcb_note_rect",
      pcb_note_rect_id: "pcb_note_rect_short_marker",
      center: SHORT_MARKER,
      width: 0.45,
      height: 0.45,
      stroke_width: 0.08,
      is_filled: false,
      has_stroke: true,
      layer: "top",
      color: "#fbbf24",
    },
    {
      type: "pcb_note_text",
      pcb_note_text_id: "pcb_note_text_error_count",
      text: `short/clearance DRC error count: ${drcErrors.length}; errors: ${errorSummary || "none"}`,
      anchor_position: { x: 4, y: -12.85 },
      anchor_alignment: "center",
      font: "tscircuit2024",
      font_size: 0.16,
      layer: "top",
      color: "#60a5fa",
    },
  ] satisfies AnyCircuitElement[]

  expect(
    convertCircuitJsonToPcbSvg(
      [...routedCopper, ...annotations, ...drcErrors],
      {
        shouldDrawErrors: true,
        showErrorsInTextOverlay: true,
      },
    ),
  ).toMatchSvgSnapshot(import.meta.path)
})
