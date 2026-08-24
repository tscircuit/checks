import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbTraceLengths, runAllRoutingChecks } from "../.."

const snapshotBoard = ({
  center,
  width,
  height,
}: {
  center: { x: number; y: number }
  width: number
  height: number
}): AnyCircuitElement => ({
  type: "pcb_board",
  pcb_board_id: "snapshot_board",
  center,
  width,
  height,
  thickness: 1.6,
  num_layers: 2,
  material: "fr4",
})

const snapshotLabel = ({
  id,
  text,
  x,
  y,
}: {
  id: string
  text: string
  x: number
  y: number
}): AnyCircuitElement => ({
  type: "pcb_silkscreen_text",
  pcb_silkscreen_text_id: id,
  pcb_component_id: "",
  anchor_position: { x, y },
  anchor_alignment: "center",
  font: "tscircuit2024",
  font_size: 0.35,
  layer: "top",
  text,
})

const expectPcbSnapshot = (
  circuitJson: AnyCircuitElement[],
  annotations: AnyCircuitElement[],
  snapshotName: string,
) => {
  const warnings = checkPcbTraceLengths(circuitJson)

  expect(
    convertCircuitJsonToPcbSvg([...annotations, ...circuitJson, ...warnings], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path, snapshotName)
}

const circuitJson = [
  {
    type: "source_trace",
    source_trace_id: "overlength_source_trace",
    connected_source_port_ids: [
      "overlength_source_port_a",
      "overlength_source_port_b",
    ],
    connected_source_net_ids: ["signal_net"],
    max_length: 10,
    subcircuit_id: "board",
  },
  {
    type: "source_trace",
    source_trace_id: "short_source_trace",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    max_length: 10,
  },
  {
    type: "source_trace",
    source_trace_id: "unconstrained_source_trace",
    connected_source_port_ids: [],
    connected_source_net_ids: [],
    max_length: null,
  },
  {
    type: "pcb_port",
    pcb_port_id: "overlength_pcb_port_a",
    source_port_id: "overlength_source_port_a",
    pcb_component_id: "component_a",
    x: 0,
    y: 0,
    layers: ["top"],
  },
  {
    type: "pcb_port",
    pcb_port_id: "overlength_pcb_port_b",
    source_port_id: "overlength_source_port_b",
    pcb_component_id: "component_b",
    x: 12,
    y: 0,
    layers: ["top"],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "overlength_pcb_trace",
    source_trace_id: "overlength_source_trace",
    subcircuit_id: "board",
    route: [
      {
        route_type: "wire",
        x: 0,
        y: 0,
        width: 0.15,
        layer: "top",
        start_pcb_port_id: "overlength_pcb_port_a",
      },
      {
        route_type: "wire",
        x: 12,
        y: 0,
        width: 0.15,
        layer: "top",
        end_pcb_port_id: "overlength_pcb_port_b",
      },
    ],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "short_pcb_trace",
    source_trace_id: "short_source_trace",
    trace_length: 8,
    route: [],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "unconstrained_pcb_trace",
    source_trace_id: "unconstrained_source_trace",
    trace_length: 20,
    route: [],
  },
] as AnyCircuitElement[]

test("warns when a PCB trace exceeds its source trace maximum length", () => {
  expect(checkPcbTraceLengths(circuitJson)).toEqual([
    {
      type: "pcb_trace_too_long_warning",
      pcb_trace_too_long_warning_id:
        "pcb_trace_too_long_warning_overlength_source_trace_overlength_pcb_trace",
      warning_type: "pcb_trace_too_long_warning",
      message: "PCB trace is 12.00mm long, exceeding the 10mm maximum",
      pcb_trace_id: "overlength_pcb_trace",
      source_trace_id: "overlength_source_trace",
      source_net_id: "signal_net",
      actual_trace_length: 12,
      maximum_trace_length: 10,
      subcircuit_id: "board",
    },
  ])
})

test("is included in the routing check pipeline", async () => {
  const results = await runAllRoutingChecks(circuitJson)

  expect(
    results.filter((result) => result.type === "pcb_trace_too_long_warning"),
  ).toEqual(checkPcbTraceLengths(circuitJson))
})

const createMultidropCircuitJson = (
  endpointPathLength: number,
): AnyCircuitElement[] => [
  {
    type: "source_trace",
    source_trace_id: "constrained_source_trace",
    connected_source_port_ids: ["source_port_a", "source_port_b"],
    connected_source_net_ids: [],
    max_length: 5,
  },
  {
    type: "source_trace",
    source_trace_id: "branch_source_trace",
    connected_source_port_ids: ["source_port_b", "source_port_c"],
    connected_source_net_ids: [],
  },
  {
    type: "source_trace",
    source_trace_id: "long_branch_source_trace",
    connected_source_port_ids: ["source_port_c", "source_port_d"],
    connected_source_net_ids: [],
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_a",
    source_port_id: "source_port_a",
    pcb_component_id: "component_a",
    x: 0,
    y: 0,
    layers: ["top"],
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_b",
    source_port_id: "source_port_b",
    pcb_component_id: "component_b",
    x: endpointPathLength,
    y: 0,
    layers: ["top"],
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_c",
    source_port_id: "source_port_c",
    pcb_component_id: "component_c",
    x: endpointPathLength / 2,
    y: 0,
    layers: ["top"],
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_d",
    source_port_id: "source_port_d",
    pcb_component_id: "component_d",
    x: 0,
    y: 20,
    layers: ["top"],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "endpoint_path_1",
    source_trace_id: "branch_source_trace",
    route: [
      {
        route_type: "wire",
        x: 0,
        y: 0,
        width: 0.15,
        layer: "top",
        start_pcb_port_id: "pcb_port_a",
      },
      {
        route_type: "wire",
        x: endpointPathLength / 2,
        y: 0,
        width: 0.15,
        layer: "top",
      },
    ],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "endpoint_path_2",
    source_trace_id: "branch_source_trace",
    route: [
      {
        route_type: "wire",
        x: endpointPathLength / 2,
        y: 0,
        width: 0.15,
        layer: "top",
      },
      {
        route_type: "wire",
        x: endpointPathLength,
        y: 0,
        width: 0.15,
        layer: "top",
        end_pcb_port_id: "pcb_port_b",
      },
    ],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "arbitrary_long_branch",
    source_trace_id: "constrained_source_trace",
    route: [
      {
        route_type: "wire",
        x: 0,
        y: 0,
        width: 0.15,
        layer: "top",
        start_pcb_port_id: "pcb_port_a",
      },
      {
        route_type: "wire",
        x: 0,
        y: 20,
        width: 0.15,
        layer: "top",
        end_pcb_port_id: "pcb_port_d",
      },
    ],
  },
]

test("ignores an arbitrary long MST branch when the constrained endpoints have a short path", () => {
  expect(checkPcbTraceLengths(createMultidropCircuitJson(4))).toEqual([])
})

test("warns using the true overlength shortest endpoint path", () => {
  const multidropCircuitJson = createMultidropCircuitJson(7)

  expect(checkPcbTraceLengths(multidropCircuitJson)).toEqual([
    expect.objectContaining({
      pcb_trace_id: "endpoint_path_1",
      source_trace_id: "constrained_source_trace",
      actual_trace_length: 7,
      maximum_trace_length: 5,
    }),
  ])

  expectPcbSnapshot(
    multidropCircuitJson,
    [
      snapshotBoard({ center: { x: 2, y: 8 }, width: 14, height: 28 }),
      snapshotLabel({
        id: "constrained_path_label",
        text: "7mm CONSTRAINED PATH",
        x: 3.5,
        y: -1.2,
      }),
      snapshotLabel({
        id: "unrelated_branch_label",
        text: "20mm UNRELATED BRANCH",
        x: 3,
        y: 18.5,
      }),
    ],
    "multidrop-constrained-endpoint-path",
  )
})

test("includes via transitions in the shortest endpoint path length", () => {
  const viaCircuitJson = [
    {
      type: "source_trace",
      source_trace_id: "via_source_trace",
      connected_source_port_ids: ["source_port_top", "source_port_bottom"],
      connected_source_net_ids: [],
      max_length: 3.5,
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_top",
      source_port_id: "source_port_top",
      pcb_component_id: "top_component",
      x: -1,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_bottom",
      source_port_id: "source_port_bottom",
      pcb_component_id: "bottom_component",
      x: 1,
      y: 0,
      layers: ["bottom"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "via_endpoint_path",
      source_trace_id: "via_source_trace",
      route: [
        {
          route_type: "wire",
          x: -1,
          y: 0,
          width: 0.15,
          layer: "top",
          start_pcb_port_id: "pcb_port_top",
        },
        { route_type: "wire", x: 0, y: 0, width: 0.15, layer: "top" },
        {
          route_type: "via",
          x: 0,
          y: 0,
          from_layer: "top",
          to_layer: "bottom",
        },
        {
          route_type: "wire",
          x: 0,
          y: 0,
          width: 0.15,
          layer: "bottom",
        },
        {
          route_type: "wire",
          x: 1,
          y: 0,
          width: 0.15,
          layer: "bottom",
          end_pcb_port_id: "pcb_port_bottom",
        },
      ],
    },
  ] as AnyCircuitElement[]

  expect(checkPcbTraceLengths(viaCircuitJson)).toEqual([
    expect.objectContaining({
      pcb_trace_id: "via_endpoint_path",
      actual_trace_length: 3.6,
      maximum_trace_length: 3.5,
    }),
  ])

  expectPcbSnapshot(
    viaCircuitJson,
    [
      snapshotBoard({ center: { x: 0, y: 0 }, width: 6, height: 4 }),
      snapshotLabel({
        id: "via_length_label",
        text: "1 + VIA 1.6 + 1 = 3.6mm",
        x: 0,
        y: -1,
      }),
    ],
    "via-transition-length",
  )

  const thinBoardCircuitJson = [
    {
      type: "pcb_board",
      pcb_board_id: "thin_board",
      center: { x: 0, y: 0 },
      width: 10,
      height: 10,
      thickness: 0.8,
      num_layers: 2,
      material: "fr4",
    },
    ...viaCircuitJson.map((element) =>
      element.type === "source_trace"
        ? { ...element, max_length: 2.7 }
        : element,
    ),
  ] as AnyCircuitElement[]

  expect(checkPcbTraceLengths(thinBoardCircuitJson)).toEqual([
    expect.objectContaining({
      pcb_trace_id: "via_endpoint_path",
      actual_trace_length: 2.8,
      maximum_trace_length: 2.7,
    }),
  ])
})

test("does not infer a unique length endpoint from a source net", () => {
  const ambiguousEndpointCircuitJson = [
    {
      type: "source_trace",
      source_trace_id: "ambiguous_source_trace",
      connected_source_port_ids: ["source_port_a"],
      connected_source_net_ids: ["source_net"],
      max_length: 1,
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "arbitrary_net_branch",
      source_trace_id: "ambiguous_source_trace",
      route: [
        { route_type: "wire", x: 0, y: 0, width: 0.15, layer: "top" },
        { route_type: "wire", x: 10, y: 0, width: 0.15, layer: "top" },
      ],
    },
  ] as AnyCircuitElement[]

  expect(checkPcbTraceLengths(ambiguousEndpointCircuitJson)).toEqual([])
})

test("connects separate same-layer traces at a geometric intersection", () => {
  const intersectingTraceCircuitJson = [
    {
      type: "source_trace",
      source_trace_id: "intersection_constraint",
      connected_source_port_ids: ["source_port_a", "source_port_b"],
      connected_source_net_ids: [],
      max_length: 3.5,
    },
    {
      type: "source_trace",
      source_trace_id: "horizontal_source_trace",
      connected_source_port_ids: ["source_port_a", "source_port_d"],
      connected_source_net_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "vertical_source_trace",
      connected_source_port_ids: ["source_port_c", "source_port_b"],
      connected_source_net_ids: [],
    },
    ...[
      ["a", -2, 0],
      ["b", 0, 2],
      ["c", 0, -2],
      ["d", 2, 0],
    ].map(([name, x, y]) => ({
      type: "pcb_port",
      pcb_port_id: `pcb_port_${name}`,
      source_port_id: `source_port_${name}`,
      pcb_component_id: `component_${name}`,
      x,
      y,
      layers: ["top"],
    })),
    {
      type: "pcb_trace",
      pcb_trace_id: "horizontal_trace",
      source_trace_id: "horizontal_source_trace",
      route: [
        {
          route_type: "wire",
          x: -2,
          y: 0,
          width: 0.15,
          layer: "top",
          start_pcb_port_id: "pcb_port_a",
        },
        {
          route_type: "wire",
          x: 2,
          y: 0,
          width: 0.15,
          layer: "top",
          end_pcb_port_id: "pcb_port_d",
        },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "vertical_trace",
      source_trace_id: "vertical_source_trace",
      route: [
        {
          route_type: "wire",
          x: 0,
          y: -2,
          width: 0.15,
          layer: "top",
          start_pcb_port_id: "pcb_port_c",
        },
        {
          route_type: "wire",
          x: 0,
          y: 2,
          width: 0.15,
          layer: "top",
          end_pcb_port_id: "pcb_port_b",
        },
      ],
    },
  ] as AnyCircuitElement[]

  expect(checkPcbTraceLengths(intersectingTraceCircuitJson)).toEqual([
    expect.objectContaining({
      source_trace_id: "intersection_constraint",
      actual_trace_length: 4,
      maximum_trace_length: 3.5,
    }),
  ])

  expectPcbSnapshot(
    intersectingTraceCircuitJson,
    [
      snapshotBoard({ center: { x: 0, y: 0 }, width: 7, height: 7 }),
      snapshotLabel({
        id: "same_layer_junction_label",
        text: "SAME-LAYER JUNCTION = 4mm",
        x: 0,
        y: -2.8,
      }),
    ],
    "same-layer-trace-intersection",
  )
})

test("uses unique warning IDs when constraints share a PCB trace", () => {
  const sharedTraceCircuitJson = [
    ...["first_constraint", "second_constraint"].map((sourceTraceId) => ({
      type: "source_trace",
      source_trace_id: sourceTraceId,
      connected_source_port_ids: ["source_port_a", "source_port_b"],
      connected_source_net_ids: [],
      max_length: 1,
    })),
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_a",
      source_port_id: "source_port_a",
      pcb_component_id: "component_a",
      x: 0,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_b",
      source_port_id: "source_port_b",
      pcb_component_id: "component_b",
      x: 2,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "shared_pcb_trace",
      source_trace_id: "first_constraint",
      route: [
        {
          route_type: "wire",
          x: 0,
          y: 0,
          width: 0.15,
          layer: "top",
          start_pcb_port_id: "pcb_port_a",
        },
        {
          route_type: "wire",
          x: 2,
          y: 0,
          width: 0.15,
          layer: "top",
          end_pcb_port_id: "pcb_port_b",
        },
      ],
    },
  ] as AnyCircuitElement[]

  expect(
    checkPcbTraceLengths(sharedTraceCircuitJson).map(
      (warning) => warning.pcb_trace_too_long_warning_id,
    ),
  ).toEqual([
    "pcb_trace_too_long_warning_first_constraint_shared_pcb_trace",
    "pcb_trace_too_long_warning_second_constraint_shared_pcb_trace",
  ])
})

test("does not connect crossing trace segments on different layers", () => {
  const crossLayerCircuitJson = [
    {
      type: "source_trace",
      source_trace_id: "cross_layer_source_trace",
      connected_source_port_ids: ["source_port_top", "source_port_bottom"],
      connected_source_net_ids: [],
      max_length: 0,
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_top",
      source_port_id: "source_port_top",
      pcb_component_id: "top_component",
      x: -1,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_bottom",
      source_port_id: "source_port_bottom",
      pcb_component_id: "bottom_component",
      x: 0,
      y: 1,
      layers: ["bottom"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "top_segment",
      source_trace_id: "cross_layer_source_trace",
      route: [
        {
          route_type: "wire",
          x: -1,
          y: 0,
          width: 0.15,
          layer: "top",
          start_pcb_port_id: "pcb_port_top",
        },
        { route_type: "wire", x: 1, y: 0, width: 0.15, layer: "top" },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "bottom_segment",
      source_trace_id: "cross_layer_source_trace",
      route: [
        { route_type: "wire", x: 0, y: -1, width: 0.15, layer: "bottom" },
        {
          route_type: "wire",
          x: 0,
          y: 1,
          width: 0.15,
          layer: "bottom",
          end_pcb_port_id: "pcb_port_bottom",
        },
      ],
    },
  ] as AnyCircuitElement[]

  expect(checkPcbTraceLengths(crossLayerCircuitJson)).toEqual([])

  expectPcbSnapshot(
    crossLayerCircuitJson,
    [
      snapshotBoard({ center: { x: 0, y: 0 }, width: 6, height: 6 }),
      snapshotLabel({
        id: "cross_layer_label",
        text: "TOP / BOTTOM CROSSING: NO VIA",
        x: 0,
        y: -2.3,
      }),
    ],
    "cross-layer-traces-do-not-connect",
  )
})
