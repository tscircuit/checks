import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"

const sourceNetId = "source_net_split"
const portXs = [-6, -3, 3, 6]

const circuitJson: AnyCircuitElement[] = [
  {
    type: "pcb_board",
    pcb_board_id: "pcb_board_0",
    center: { x: 0, y: 0 },
    width: 30,
    height: 6,
    material: "fr4",
    thickness: 1.6,
    num_layers: 2,
  },
  {
    type: "source_net",
    source_net_id: sourceNetId,
    name: "SPLIT_NET",
    member_source_group_ids: [],
  },
  ...portXs.flatMap((x, index): AnyCircuitElement[] => [
    {
      type: "source_trace",
      source_trace_id: `source_trace_port_${index}`,
      connected_source_port_ids: [`source_port_${index}`],
      connected_source_net_ids: [sourceNetId],
    },
    {
      type: "pcb_port",
      pcb_port_id: `pcb_port_${index}`,
      source_port_id: `source_port_${index}`,
      x,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: `pcb_smtpad_${index}`,
      pcb_port_id: `pcb_port_${index}`,
      shape: "rect",
      x,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
  ]),
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_left_group",
    source_trace_id: sourceNetId,
    route: [
      {
        route_type: "wire",
        x: -6,
        y: 0,
        width: 0.2,
        layer: "top",
        start_pcb_port_id: "pcb_port_0",
      },
      {
        route_type: "wire",
        x: -3,
        y: 0,
        width: 0.2,
        layer: "top",
        end_pcb_port_id: "pcb_port_1",
      },
    ],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_right_group",
    source_trace_id: sourceNetId,
    route: [
      {
        route_type: "wire",
        x: 3,
        y: 0,
        width: 0.2,
        layer: "top",
        start_pcb_port_id: "pcb_port_2",
      },
      {
        route_type: "wire",
        x: 6,
        y: 0,
        width: 0.2,
        layer: "top",
        end_pcb_port_id: "pcb_port_3",
      },
    ],
  },
]

test("reports a four-port source net split into two copper groups", () => {
  const errors = checkTracesAreContiguous(circuitJson)

  expect(errors).toEqual([
    expect.objectContaining({
      type: "pcb_trace_error",
      pcb_trace_error_id: `disconnected_copper_groups_${sourceNetId}`,
      pcb_port_ids: ["pcb_port_0", "pcb_port_1", "pcb_port_2", "pcb_port_3"],
      message:
        "Net [SPLIT_NET] has 4 required PCB ports split across 2 disconnected copper groups.",
    }),
  ])
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)

  const bridgeTrace: AnyCircuitElement = {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_bridge",
    source_trace_id: sourceNetId,
    route: [
      {
        route_type: "wire",
        x: -3,
        y: 0,
        width: 0.2,
        layer: "top",
      },
      {
        route_type: "wire",
        x: 3,
        y: 0,
        width: 0.2,
        layer: "top",
      },
    ],
  }

  expect(checkTracesAreContiguous([...circuitJson, bridgeTrace])).toHaveLength(
    0,
  )

  const connectingPour: AnyCircuitElement = {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "pcb_copper_pour_split_net",
    source_net_id: sourceNetId,
    shape: "rect",
    center: { x: 0, y: 0 },
    width: 14,
    height: 2,
    layer: "top",
    covered_with_solder_mask: true,
  }

  // Plane/pour geometry is not in PcbConnectivityMap yet, so trace-only
  // connectivity must not report a false open for a poured net.
  expect(
    checkTracesAreContiguous([...circuitJson, connectingPour]),
  ).toHaveLength(0)
})

test("treats traces meeting through a breakout point as one copper group", () => {
  const parentNetId = "source_net_parent"
  const childNetId = "source_net_child"
  const breakoutCircuitJson: AnyCircuitElement[] = [
    {
      type: "source_net",
      source_net_id: parentNetId,
      name: "VCC",
      member_source_group_ids: [],
    },
    {
      type: "source_net",
      source_net_id: childNetId,
      name: "VCC",
      member_source_group_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_child_to_parent",
      connected_source_port_ids: ["source_port_child"],
      connected_source_net_ids: [parentNetId],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_load",
      connected_source_port_ids: ["source_port_load"],
      connected_source_net_ids: [parentNetId],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_internal",
      connected_source_port_ids: ["source_port_child"],
      connected_source_net_ids: [childNetId],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_child",
      source_port_id: "source_port_child",
      x: -3,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_child",
      pcb_port_id: "pcb_port_child",
      shape: "rect",
      x: -3,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_load",
      source_port_id: "source_port_load",
      x: 3,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_load",
      pcb_port_id: "pcb_port_load",
      shape: "rect",
      x: 3,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    {
      type: "pcb_breakout_point",
      pcb_breakout_point_id: "pcb_breakout_point_0",
      pcb_group_id: "pcb_group_child",
      source_port_id: "source_port_child",
      source_trace_id: "source_trace_internal",
      source_net_id: childNetId,
      x: 0,
      y: 0,
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_internal",
      source_trace_id: "source_trace_internal",
      route: [
        {
          route_type: "wire",
          x: -3,
          y: 0,
          width: 0.15,
          layer: "top",
          start_pcb_port_id: "pcb_port_child",
        },
        {
          route_type: "wire",
          x: 0,
          y: 0,
          width: 0.15,
          layer: "top",
        },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_parent",
      source_trace_id: "source_trace_load",
      route: [
        {
          route_type: "wire",
          x: 3,
          y: 0,
          width: 0.15,
          layer: "top",
          start_pcb_port_id: "pcb_port_load",
        },
        {
          route_type: "wire",
          x: 0.0001,
          y: 0,
          width: 0.15,
          layer: "top",
        },
      ],
    },
  ]

  expect(checkTracesAreContiguous(breakoutCircuitJson)).toHaveLength(0)

  const parentTrace = breakoutCircuitJson.find(
    (element) =>
      element.type === "pcb_trace" &&
      element.pcb_trace_id === "pcb_trace_parent",
  )
  if (parentTrace?.type !== "pcb_trace") {
    throw new Error("missing parent PCB trace")
  }
  const disconnectedParentTrace: typeof parentTrace = {
    ...parentTrace,
    route: parentTrace.route.map((point, index) =>
      index === parentTrace.route.length - 1 && point.route_type === "wire"
        ? { ...point, x: 0.2 }
        : point,
    ),
  }
  const disconnectedCircuitJson = breakoutCircuitJson.map((element) =>
    element === parentTrace ? disconnectedParentTrace : element,
  )

  expect(checkTracesAreContiguous(disconnectedCircuitJson)).toContainEqual(
    expect.objectContaining({
      pcb_trace_error_id: `disconnected_copper_groups_${parentNetId}`,
    }),
  )
})
