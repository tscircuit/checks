import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import {
  NetTieManager,
  checkCopperPourShorts,
  checkDanglingTraces,
  checkDifferentNetViaSpacing,
  checkEachPcbPortConnectedToPcbTraces,
  checkEachPcbTraceNonOverlapping,
  checkPadPadClearance,
  checkPadTraceClearance,
  checkViaPadClearance,
  checkViaTraceClearance,
  parseNetTiePadGroups,
  runAllChecks,
  runAllPlacementChecks,
  runAllRoutingChecks,
} from "../../index"

function createStarGroundBoard({
  includeBridgePad = true,
  padGroupProp,
}: {
  includeBridgePad?: boolean
  padGroupProp?: string[]
} = {}): AnyCircuitElement[] {
  const elements: unknown[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board_1",
      center: { x: 0, y: 0 },
      width: 30,
      height: 20,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
    },
    {
      type: "source_net",
      source_net_id: "net_agnd",
      name: "AGND",
      member_source_group_ids: [],
    },
    {
      type: "source_net",
      source_net_id: "net_dgnd",
      name: "DGND",
      member_source_group_ids: [],
    },
    {
      type: "source_net",
      source_net_id: "net_vcc",
      name: "VCC",
      member_source_group_ids: [],
    },
    // Net-tie component NT1 at (0, 0)
    {
      type: "source_component",
      source_component_id: "src_nt1",
      name: "NT1",
      ftype: "simple_chip",
      is_net_tie: true,
      ...(padGroupProp ? { net_tie_pad_groups: padGroupProp } : {}),
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_nt1",
      source_component_id: "src_nt1",
      center: { x: 0, y: 0 },
      layer: "top",
      rotation: 0,
      width: 1,
      height: 0.5,
      is_net_tie: true,
      ...(padGroupProp ? { net_tie_pad_groups: padGroupProp } : {}),
    },
    {
      type: "source_port",
      source_port_id: "sp_nt1_1",
      source_component_id: "src_nt1",
      name: "pin1",
      pin_number: 1,
      port_hints: ["1", "pin1"],
    },
    {
      type: "source_port",
      source_port_id: "sp_nt1_2",
      source_component_id: "src_nt1",
      name: "pin2",
      pin_number: 2,
      port_hints: ["2", "pin2"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pp_nt1_1",
      pcb_component_id: "pcb_nt1",
      source_port_id: "sp_nt1_1",
      x: -0.25,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pp_nt1_2",
      pcb_component_id: "pcb_nt1",
      source_port_id: "sp_nt1_2",
      x: 0.25,
      y: 0,
      layers: ["top"],
    },
    // Overlapping/touching pads on NT1
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_nt1_1",
      pcb_component_id: "pcb_nt1",
      pcb_port_id: "pp_nt1_1",
      port_hints: ["1"],
      shape: "rect",
      x: -0.25,
      y: 0,
      width: 0.55,
      height: 0.5,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_nt1_2",
      pcb_component_id: "pcb_nt1",
      pcb_port_id: "pp_nt1_2",
      port_hints: ["2"],
      shape: "rect",
      x: 0.25,
      y: 0,
      width: 0.55,
      height: 0.5,
      layer: "top",
    },
    // Remote analog ground test point TP_A at (-8, 0)
    {
      type: "source_component",
      source_component_id: "src_tp_a",
      name: "TP_A",
      ftype: "simple_test_point",
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_tp_a",
      source_component_id: "src_tp_a",
      center: { x: -8, y: 0 },
      layer: "top",
      rotation: 0,
      width: 1,
      height: 1,
    },
    {
      type: "source_port",
      source_port_id: "sp_tp_a",
      source_component_id: "src_tp_a",
      name: "pin1",
      pin_number: 1,
    },
    {
      type: "pcb_port",
      pcb_port_id: "pp_tp_a",
      pcb_component_id: "pcb_tp_a",
      source_port_id: "sp_tp_a",
      x: -8,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_tp_a",
      pcb_component_id: "pcb_tp_a",
      pcb_port_id: "pp_tp_a",
      shape: "rect",
      x: -8,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    // Remote digital ground test point TP_D at (8, 0)
    {
      type: "source_component",
      source_component_id: "src_tp_d",
      name: "TP_D",
      ftype: "simple_test_point",
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_tp_d",
      source_component_id: "src_tp_d",
      center: { x: 8, y: 0 },
      layer: "top",
      rotation: 0,
      width: 1,
      height: 1,
    },
    {
      type: "source_port",
      source_port_id: "sp_tp_d",
      source_component_id: "src_tp_d",
      name: "pin1",
      pin_number: 1,
    },
    {
      type: "pcb_port",
      pcb_port_id: "pp_tp_d",
      pcb_component_id: "pcb_tp_d",
      source_port_id: "sp_tp_d",
      x: 8,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_tp_d",
      pcb_component_id: "pcb_tp_d",
      pcb_port_id: "pp_tp_d",
      shape: "rect",
      x: 8,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    // Source traces keeping AGND and DGND logically distinct
    {
      type: "source_trace",
      source_trace_id: "st_agnd",
      connected_source_port_ids: ["sp_tp_a", "sp_nt1_1"],
      connected_source_net_ids: ["net_agnd"],
    },
    {
      type: "source_trace",
      source_trace_id: "st_dgnd",
      connected_source_port_ids: ["sp_tp_d", "sp_nt1_2"],
      connected_source_net_ids: ["net_dgnd"],
    },
    // PCB traces landing on NT1.1 and NT1.2
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_agnd",
      source_trace_id: "st_agnd",
      route: [
        {
          route_type: "wire",
          x: -8,
          y: 0,
          width: 0.25,
          layer: "top",
          start_pcb_port_id: "pp_tp_a",
        },
        {
          route_type: "wire",
          x: -0.25,
          y: 0,
          width: 0.25,
          layer: "top",
          end_pcb_port_id: "pp_nt1_1",
        },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_dgnd",
      source_trace_id: "st_dgnd",
      route: [
        {
          route_type: "wire",
          x: 8,
          y: 0,
          width: 0.25,
          layer: "top",
          start_pcb_port_id: "pp_tp_d",
        },
        {
          route_type: "wire",
          x: 0.25,
          y: 0,
          width: 0.25,
          layer: "top",
          end_pcb_port_id: "pp_nt1_2",
        },
      ],
    },
  ]

  if (includeBridgePad) {
    elements.push({
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_nt1_bridge",
      pcb_component_id: "pcb_nt1",
      shape: "rect",
      x: 0,
      y: 0,
      width: 0.4,
      height: 0.25,
      layer: "top",
    })
  }

  return elements as AnyCircuitElement[]
}

describe("Net ties (intentional single-point net joins)", () => {
  test("parses KiCad and array net_tie_pad_groups formats", () => {
    expect(parseNetTiePadGroups(["1,2"])).toEqual([["1", "2"]])
    expect(parseNetTiePadGroups(["1, 2", "3, 4"])).toEqual([
      ["1", "2"],
      ["3", "4"],
    ])
    expect(
      parseNetTiePadGroups([
        ["1", "2"],
        ["3", "4"],
      ]),
    ).toEqual([
      ["1", "2"],
      ["3", "4"],
    ])
    expect(parseNetTiePadGroups(["pin1", "pin2"])).toEqual([["pin1", "pin2"]])
  })

  test("allows AGND and DGND to join at a KiCad-style net-tie footprint without merging nets globally", async () => {
    const circuitJson = createStarGroundBoard({
      includeBridgePad: true,
      padGroupProp: ["1,2"],
    })

    const connMap = getFullConnectivityMapFromCircuitJson(circuitJson)
    expect(connMap.areIdsConnected("net_agnd", "net_dgnd")).toBe(false)
    expect(connMap.areIdsConnected("trace_agnd", "trace_dgnd")).toBe(false)

    const placementErrors = await runAllPlacementChecks(circuitJson)
    const routingErrors = await runAllRoutingChecks(circuitJson)
    const allErrors = await runAllChecks(circuitJson)

    expect(placementErrors).toEqual([])
    expect(routingErrors).toEqual([])
    expect(allErrors).toEqual([])
  })

  test("still reports DRC errors when tied nets short or violate clearance away from the net tie", () => {
    const circuitJson = createStarGroundBoard({ padGroupProp: ["1,2"] })

    // Add a rogue DGND branch that crosses AGND at x = -5 (far from NT1 at x = 0)
    circuitJson.push({
      type: "pcb_trace",
      pcb_trace_id: "trace_dgnd_rogue",
      source_trace_id: "st_dgnd",
      route: [
        { route_type: "wire", x: -5, y: -2, width: 0.25, layer: "top" },
        { route_type: "wire", x: -5, y: 2, width: 0.25, layer: "top" },
      ],
    } as AnyCircuitElement)

    const traceErrors = checkEachPcbTraceNonOverlapping(circuitJson)
    expect(traceErrors.length).toBeGreaterThan(0)
    expect(traceErrors[0]?.type).toBe("pcb_trace_error")

    // Remote pads of AGND and DGND placed 0.05mm apart away from NT1 must also fail pad-pad clearance
    const remotePadBoard = createStarGroundBoard({ padGroupProp: ["1,2"] })
    remotePadBoard.push(
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_remote_agnd",
        pcb_port_id: "pp_tp_a",
        shape: "rect",
        x: -5,
        y: 4,
        width: 0.5,
        height: 0.5,
        layer: "top",
      } as AnyCircuitElement,
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_remote_dgnd",
        pcb_port_id: "pp_tp_d",
        shape: "rect",
        x: -4.45,
        y: 4,
        width: 0.5,
        height: 0.5,
        layer: "top",
      } as AnyCircuitElement,
    )
    expect(checkPadPadClearance(remotePadBoard)).toHaveLength(1)
  })

  test("catches parallel traces that violate clearance outside the net tie even when terminating at the net tie", () => {
    const circuitJson = createStarGroundBoard({ padGroupProp: ["1,2"] })

    // Route DGND parallel and 0.05mm away from AGND all the way from x = -6 to the net tie at x = 0.25
    const dgndTrace = circuitJson.find(
      (el) => el.type === "pcb_trace" && el.pcb_trace_id === "trace_dgnd",
    )
    if (dgndTrace && dgndTrace.type === "pcb_trace") {
      dgndTrace.route = [
        { route_type: "wire", x: -6, y: 0.15, width: 0.25, layer: "top" },
        {
          route_type: "wire",
          x: 0.25,
          y: 0.15,
          width: 0.25,
          layer: "top",
          end_pcb_port_id: "pp_nt1_2",
        },
      ]
    }

    const traceErrors = checkEachPcbTraceNonOverlapping(circuitJson)
    expect(traceErrors.length).toBeGreaterThan(0)
  })

  test("still reports DRC errors when an unrelated third net (VCC) approaches or touches the net tie", () => {
    const circuitJson = createStarGroundBoard({ padGroupProp: ["1,2"] })

    circuitJson.push(
      {
        type: "source_trace",
        source_trace_id: "st_vcc",
        connected_source_port_ids: [],
        connected_source_net_ids: ["net_vcc"],
      } as AnyCircuitElement,
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_vcc",
        source_trace_id: "st_vcc",
        route: [
          { route_type: "wire", x: -2, y: 0.3, width: 0.2, layer: "top" },
          { route_type: "wire", x: 2, y: 0.3, width: 0.2, layer: "top" },
        ],
      } as AnyCircuitElement,
    )

    const padTraceErrors = checkPadTraceClearance(circuitJson)
    const overlapErrors = checkEachPcbTraceNonOverlapping(circuitJson)
    expect(padTraceErrors.length + overlapErrors.length).toBeGreaterThan(0)
  })

  test("isolates independent pad groups on a dual net-tie footprint (net_tie_pad_groups: ['1,2', '3,4'])", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_board",
        pcb_board_id: "board_dual",
        center: { x: 0, y: 0 },
        width: 20,
        height: 20,
        thickness: 1.6,
        num_layers: 2,
        material: "fr4",
      },
      {
        type: "source_net",
        source_net_id: "net_agnd",
        name: "AGND",
        member_source_group_ids: [],
      },
      {
        type: "source_net",
        source_net_id: "net_dgnd",
        name: "DGND",
        member_source_group_ids: [],
      },
      {
        type: "source_net",
        source_net_id: "net_avdd",
        name: "AVDD",
        member_source_group_ids: [],
      },
      {
        type: "source_net",
        source_net_id: "net_dvdd",
        name: "DVDD",
        member_source_group_ids: [],
      },
      {
        type: "source_component",
        source_component_id: "src_nt_dual",
        name: "NT_DUAL",
        ftype: "simple_chip",
        net_tie_pad_groups: ["1,2", "3,4"],
      } as unknown as AnyCircuitElement,
      {
        type: "pcb_component",
        pcb_component_id: "pcb_nt_dual",
        source_component_id: "src_nt_dual",
        center: { x: 0, y: 0 },
        layer: "top",
        rotation: 0,
        width: 2,
        height: 2,
        obstructs_within_bounds: false,
      },
      ...[
        { pin: 1, net: "net_agnd", x: -0.2, y: -1 },
        { pin: 2, net: "net_dgnd", x: 0.2, y: -1 },
        { pin: 3, net: "net_avdd", x: -0.2, y: 1 },
        { pin: 4, net: "net_dvdd", x: 0.2, y: 1 },
      ].flatMap(({ pin, net, x, y }) => [
        {
          type: "source_port" as const,
          source_port_id: `sp_${pin}`,
          source_component_id: "src_nt_dual",
          name: `pin${pin}`,
          pin_number: pin,
        },
        {
          type: "pcb_port" as const,
          pcb_port_id: `pp_${pin}`,
          pcb_component_id: "pcb_nt_dual",
          source_port_id: `sp_${pin}`,
          x,
          y,
          layers: ["top" as const],
        },
        {
          type: "pcb_smtpad" as const,
          pcb_smtpad_id: `pad_${pin}`,
          pcb_component_id: "pcb_nt_dual",
          pcb_port_id: `pp_${pin}`,
          port_hints: [String(pin)],
          shape: "rect" as const,
          x,
          y,
          width: 0.5,
          height: 0.5,
          layer: "top" as const,
        },
        {
          type: "source_trace" as const,
          source_trace_id: `st_${pin}`,
          connected_source_port_ids: [`sp_${pin}`],
          connected_source_net_ids: [net],
        },
      ]),
    ]

    expect(checkPadPadClearance(circuitJson)).toEqual([])

    // Now move pad_3 (AVDD) right next to pad_1 (AGND) — cross-group contact MUST fail!
    const pad3 = circuitJson.find(
      (el) => el.type === "pcb_smtpad" && el.pcb_smtpad_id === "pad_3",
    )
    if (pad3 && pad3.type === "pcb_smtpad" && pad3.shape === "rect") {
      pad3.y = -0.6
    }
    expect(checkPadPadClearance(circuitJson).length).toBeGreaterThan(0)
  })

  test("does not mask unrouted nets across touching net-tie pads", () => {
    const circuitJson = createStarGroundBoard({
      includeBridgePad: false,
      padGroupProp: ["1,2"],
    })
    // Remove trace_dgnd so DGND is unrouted even though pad_nt1_2 touches pad_nt1_1 (AGND)
    const withoutDgndTrace = circuitJson.filter(
      (el) => !(el.type === "pcb_trace" && el.pcb_trace_id === "trace_dgnd"),
    )

    const portErrors = checkEachPcbPortConnectedToPcbTraces(withoutDgndTrace)
    expect(portErrors.length).toBeGreaterThan(0)
  })

  test("exempts copper pour star-ground bridges inside net tie while catching pour shorts outside", () => {
    const baseCircuit: AnyCircuitElement[] = [
      {
        type: "source_net",
        source_net_id: "net_agnd",
        name: "AGND",
        member_source_group_ids: [],
      },
      {
        type: "source_net",
        source_net_id: "net_dgnd",
        name: "DGND",
        member_source_group_ids: [],
      },
      {
        type: "pcb_copper_pour",
        pcb_copper_pour_id: "pour_agnd",
        shape: "brep",
        layer: "top",
        covered_with_solder_mask: true,
        source_net_id: "net_agnd",
        brep_shape: {
          outer_ring: {
            vertices: [
              { x: -5, y: -2 },
              { x: 0.1, y: -2 },
              { x: 0.1, y: 2 },
              { x: -5, y: 2 },
            ],
          },
          inner_rings: [],
        },
      } as AnyCircuitElement,
      {
        type: "pcb_copper_pour",
        pcb_copper_pour_id: "pour_dgnd",
        shape: "brep",
        layer: "top",
        covered_with_solder_mask: true,
        source_net_id: "net_dgnd",
        brep_shape: {
          outer_ring: {
            vertices: [
              { x: 0.5, y: -2 },
              { x: 5, y: -2 },
              { x: 5, y: 2 },
              { x: 0.5, y: 2 },
            ],
          },
          inner_rings: [],
        },
      } as AnyCircuitElement,
      // Narrow neck of DGND pour reaching into the tie region at (0, 0)
      {
        type: "pcb_copper_pour",
        pcb_copper_pour_id: "pour_dgnd_neck",
        shape: "brep",
        layer: "top",
        covered_with_solder_mask: true,
        source_net_id: "net_dgnd",
        brep_shape: {
          outer_ring: {
            vertices: [
              { x: -0.1, y: -0.2 },
              { x: 0.6, y: -0.2 },
              { x: 0.6, y: 0.2 },
              { x: -0.1, y: 0.2 },
            ],
          },
          inner_rings: [],
        },
      } as AnyCircuitElement,
    ]

    // Without net tie, pour_agnd and pour_dgnd_neck short
    expect(checkCopperPourShorts(baseCircuit)).toHaveLength(1)

    // With net tie covering [-0.2, 0.2] x [-0.3, 0.3], the intentional neck bridge is exempt
    expect(
      checkCopperPourShorts(baseCircuit, {
        netTies: [
          {
            nets: ["AGND", "DGND"],
            center: { x: 0, y: 0 },
            width: 0.4,
            height: 0.6,
            layer: "top",
          },
        ],
      }),
    ).toEqual([])

    // If pour_agnd and pour_dgnd ALSO overlap outside the net tie (e.g. at y = 1.5), still reports short
    const outsideShortCircuit: AnyCircuitElement[] = [
      ...baseCircuit,
      {
        type: "pcb_copper_pour",
        pcb_copper_pour_id: "pour_dgnd_outside_short",
        shape: "brep",
        layer: "top",
        covered_with_solder_mask: true,
        source_net_id: "net_dgnd",
        brep_shape: {
          outer_ring: {
            vertices: [
              { x: -0.1, y: 1.4 },
              { x: 0.6, y: 1.4 },
              { x: 0.6, y: 1.8 },
              { x: -0.1, y: 1.8 },
            ],
          },
          inner_rings: [],
        },
      } as AnyCircuitElement,
    ]
    expect(
      checkCopperPourShorts(outsideShortCircuit, {
        netTies: [
          {
            nets: ["AGND", "DGND"],
            center: { x: 0, y: 0 },
            width: 0.4,
            height: 0.6,
            layer: "top",
          },
        ],
      }),
    ).toHaveLength(1)
  })

  test("supports padless point net ties for 90-degree traces and vias without dangling-trace or via-clearance errors", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "pcb_board",
        pcb_board_id: "board_point",
        center: { x: 0, y: 0 },
        width: 20,
        height: 20,
        thickness: 1.6,
        num_layers: 2,
        material: "fr4",
        net_ties: [
          {
            net_tie_id: "tie_origin",
            nets: ["AGND", "DGND"],
            center: { x: 0, y: 0 },
            radius: 0.3,
            layers: ["top", "bottom"],
          },
        ],
      } as unknown as AnyCircuitElement,
      {
        type: "source_net",
        source_net_id: "net_agnd",
        name: "AGND",
        member_source_group_ids: [],
      },
      {
        type: "source_net",
        source_net_id: "net_dgnd",
        name: "DGND",
        member_source_group_ids: [],
      },
      {
        type: "source_port",
        source_port_id: "sp_agnd_far",
        name: "P1",
      },
      {
        type: "source_port",
        source_port_id: "sp_dgnd_far",
        name: "P2",
      },
      {
        type: "pcb_port",
        pcb_port_id: "pp_agnd_far",
        source_port_id: "sp_agnd_far",
        x: -5,
        y: 0,
        layers: ["top"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "pp_dgnd_far",
        source_port_id: "sp_dgnd_far",
        x: 0,
        y: 5,
        layers: ["top"],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_agnd_far",
        pcb_port_id: "pp_agnd_far",
        shape: "rect",
        x: -5,
        y: 0,
        width: 0.8,
        height: 0.8,
        layer: "top",
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_dgnd_far",
        pcb_port_id: "pp_dgnd_far",
        shape: "rect",
        x: 0,
        y: 5,
        width: 0.8,
        height: 0.8,
        layer: "top",
      },
      {
        type: "source_trace",
        source_trace_id: "st_agnd",
        connected_source_port_ids: ["sp_agnd_far"],
        connected_source_net_ids: ["net_agnd"],
      },
      {
        type: "source_trace",
        source_trace_id: "st_dgnd",
        connected_source_port_ids: ["sp_dgnd_far"],
        connected_source_net_ids: ["net_dgnd"],
      },
      // Vias right inside the tie region
      {
        type: "pcb_via",
        pcb_via_id: "via_agnd_tie",
        x: -0.15,
        y: 0,
        outer_diameter: 0.5,
        hole_diameter: 0.25,
        layers: ["top", "bottom"],
        pcb_trace_id: "trace_agnd",
      },
      {
        type: "pcb_via",
        pcb_via_id: "via_dgnd_tie",
        x: 0,
        y: 0.15,
        outer_diameter: 0.5,
        hole_diameter: 0.25,
        layers: ["top", "bottom"],
        pcb_trace_id: "trace_dgnd",
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_agnd",
        source_trace_id: "st_agnd",
        route: [
          { route_type: "wire", x: -5, y: 0, width: 0.2, layer: "top" },
          { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_dgnd",
        source_trace_id: "st_dgnd",
        route: [
          { route_type: "wire", x: 0, y: 5, width: 0.2, layer: "top" },
          { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
        ],
      },
    ]

    const mgr = new NetTieManager(circuitJson)
    expect(mgr.hasNetTies).toBe(true)
    expect(checkEachPcbTraceNonOverlapping(circuitJson)).toEqual([])
    expect(checkDanglingTraces(circuitJson)).toEqual([])
    expect(checkDifferentNetViaSpacing(circuitJson)).toEqual([])
    expect(checkViaTraceClearance(circuitJson)).toEqual([])
    expect(checkViaPadClearance(circuitJson)).toEqual([])
  })
})
