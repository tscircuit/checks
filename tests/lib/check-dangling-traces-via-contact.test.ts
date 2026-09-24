import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { describe, expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbTrace,
  PcbVia,
} from "circuit-json"
import { checkDanglingTraces } from "lib/check-dangling-traces/check-dangling-traces"

const TARGET_TRACE_ID = "pcb_trace_target"
const BRANCH_TRACE_ID = "pcb_trace_branch"
const END_ERROR = "disconnected_endpoint_pcb_trace_target_end"
type RoutePoint = PcbTrace["route"][number]
type WirePoint = Extract<RoutePoint, { route_type: "wire" }>
type ViaPoint = Extract<RoutePoint, { route_type: "via" }>
type PcbLayer = WirePoint["layer"]

const board: PcbBoard = {
  type: "pcb_board",
  pcb_board_id: "pcb_board_1",
  center: { x: 0, y: 0 },
  width: 20,
  height: 20,
  thickness: 1.6,
  material: "fr4",
  num_layers: 4,
}

function sourceTrace(
  sourceTraceId: string,
  connected_source_port_ids: string[] = [],
) {
  return {
    type: "source_trace" as const,
    source_trace_id: sourceTraceId,
    connected_source_port_ids,
    connected_source_net_ids: ["source_net_a"],
  }
}

function wirePoint({
  x,
  y,
  layer = "top",
  width = 0.2,
  start_pcb_port_id,
  end_pcb_port_id,
}: {
  x: number
  y: number
  layer?: PcbLayer
  width?: number
  start_pcb_port_id?: string
  end_pcb_port_id?: string
}): WirePoint {
  return {
    route_type: "wire",
    x,
    y,
    layer,
    width,
    start_pcb_port_id,
    end_pcb_port_id,
  }
}

function viaPoint({
  from_layer = "top",
  to_layer = "bottom",
  outer_diameter,
  x = 0,
}: {
  from_layer?: PcbLayer
  to_layer?: PcbLayer
  outer_diameter?: number
  x?: number
} = {}): ViaPoint {
  return { route_type: "via", x, y: 0, from_layer, to_layer, outer_diameter }
}

function trace({
  pcb_trace_id,
  source_trace_id,
  route,
}: {
  pcb_trace_id: string
  source_trace_id?: string
  route: PcbTrace["route"]
}): PcbTrace {
  return {
    type: "pcb_trace",
    pcb_trace_id,
    source_trace_id,
    route,
  }
}

function anchorPad({
  x,
  y,
  layer = "top",
  pcb_port_id = `pcb_port_anchor_${x}_${y}_${layer}`,
}: {
  x: number
  y: number
  layer?: PcbLayer
  pcb_port_id?: string
}) {
  return {
    type: "pcb_smtpad" as const,
    pcb_smtpad_id: `pcb_smtpad_anchor_${x}_${y}_${layer}`,
    pcb_port_id,
    shape: "rect" as const,
    x,
    y,
    width: 0.3,
    height: 0.3,
    layer,
  }
}

function materializedVia({
  pcb_trace_id,
  source_net_id,
  x = 0,
  y = 0,
  layers = ["top", "inner1", "inner2", "bottom"],
}: {
  pcb_trace_id?: string | null
  source_net_id?: string
  x?: number
  y?: number
  layers?: PcbVia["layers"]
} = {}): PcbVia {
  if (pcb_trace_id === undefined) {
    pcb_trace_id = BRANCH_TRACE_ID
  }
  const pcbVia: PcbVia = {
    type: "pcb_via",
    pcb_via_id: "pcb_via_branch",
    source_net_id,
    x,
    y,
    hole_diameter: 0.2,
    outer_diameter: 0.4,
    layers,
  }
  if (pcb_trace_id !== null) {
    pcbVia.pcb_trace_id = pcb_trace_id
  }
  return pcbVia
}

function targetCircuit({
  layer = "top",
  endX = 0,
  viaAnchorLayer,
  branchRoute = [],
}: {
  layer?: PcbLayer
  endX?: number
  viaAnchorLayer?: PcbLayer
  branchRoute?: RoutePoint[]
} = {}): AnyCircuitElement[] {
  if (viaAnchorLayer === undefined) {
    viaAnchorLayer = "top"
    if (layer === "top") {
      viaAnchorLayer = "bottom"
    }
  }
  return [
    board,
    sourceTrace("source_trace_target"),
    sourceTrace("source_trace_branch", ["source_port_via_anchor"]),
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_via_anchor",
      source_port_id: "source_port_via_anchor",
      x: 0,
      y: 0,
      layers: [viaAnchorLayer],
    },
    anchorPad({
      x: 0,
      y: 0,
      layer: viaAnchorLayer,
      pcb_port_id: "pcb_port_via_anchor",
    }),
    anchorPad({ x: -2, y: 0, layer }),
    trace({
      pcb_trace_id: TARGET_TRACE_ID,
      route: [
        wirePoint({ x: -2, y: 0, layer }),
        wirePoint({ x: endX, y: 0, layer }),
      ],
      source_trace_id: "source_trace_target",
    }),
    trace({
      pcb_trace_id: BRANCH_TRACE_ID,
      route: branchRoute,
      source_trace_id: "source_trace_branch",
    }),
  ]
}

function targetErrorIds(circuitJson: AnyCircuitElement[]) {
  return checkDanglingTraces(circuitJson)
    .filter((error) => error.pcb_trace_id === TARGET_TRACE_ID)
    .map((error) => error.pcb_trace_error_id)
}

describe("net-level wire endpoints contacting separate via copper", () => {
  for (const layer of ["top", "inner1", "inner2", "bottom"] as const) {
    test(`accepts materialized through-via contact on ${layer}`, () => {
      expect(
        targetErrorIds([...targetCircuit({ layer }), materializedVia()]),
      ).toEqual([])
    })
  }

  test("accepts a via linked directly to the shared source net", () => {
    expect(
      targetErrorIds([
        ...targetCircuit({ layer: "inner1" }),
        materializedVia({
          pcb_trace_id: null,
          source_net_id: "source_net_a",
        }),
      ]),
    ).toEqual([])
  })

  test("accepts contact at the combined trace and via copper radii", () => {
    expect(
      targetErrorIds([
        ...targetCircuit({ layer: "inner1", endX: 0.3 }),
        materializedVia(),
      ]),
    ).toEqual([])
  })

  test("rejects a copper-radius near miss", () => {
    expect(
      targetErrorIds([
        ...targetCircuit({ layer: "inner1", endX: 0.300000002 }),
        materializedVia(),
      ]),
    ).toEqual([END_ERROR])
  })

  test("rejects a via on a different source net", () => {
    expect(
      targetErrorIds([
        ...targetCircuit({ layer: "inner1" }),
        materializedVia({
          pcb_trace_id: null,
          source_net_id: "source_net_other",
        }),
      ]),
    ).toEqual([END_ERROR])
  })

  test("rejects an unlinked via with no known logical net", () => {
    expect(
      targetErrorIds([
        ...targetCircuit({ layer: "inner1" }),
        materializedVia({ pcb_trace_id: null }),
      ]),
    ).toEqual([END_ERROR])
  })

  test("rejects contact on a layer outside a buried via span", () => {
    expect(
      targetErrorIds([
        ...targetCircuit({ layer: "top" }),
        materializedVia({ layers: ["inner1", "inner2"] }),
      ]),
    ).toEqual([END_ERROR])
  })

  test("accepts a buried via on its declared copper layers", () => {
    expect(
      targetErrorIds([
        ...targetCircuit({
          layer: "inner2",
          endX: 0,
          viaAnchorLayer: "inner1",
        }),
        materializedVia({ layers: ["inner1", "inner2"] }),
      ]),
    ).toEqual([])
  })

  test("rejects an isolated same-net via with no onward copper", () => {
    const circuitJson = targetCircuit({ layer: "inner1" }).filter(
      (element) =>
        element.type !== "pcb_smtpad" ||
        element.pcb_port_id !== "pcb_port_via_anchor",
    )
    expect(targetErrorIds([...circuitJson, materializedVia()])).toEqual([
      END_ERROR,
    ])
  })

  test("does not use a top pad as onward copper for a buried via", () => {
    expect(
      targetErrorIds([
        ...targetCircuit({ layer: "inner2" }),
        materializedVia({ layers: ["inner1", "inner2"] }),
      ]),
    ).toEqual([END_ERROR])
  })

  test("rejects a remote via even when it belongs to the same logical net", () => {
    expect(
      targetErrorIds([
        ...targetCircuit({ layer: "inner1" }),
        materializedVia({ x: 2, y: 2 }),
      ]),
    ).toEqual([END_ERROR])
  })

  test("does not use a trace's own via to excuse its dangling endpoint", () => {
    expect(
      targetErrorIds([
        ...targetCircuit({ layer: "inner1" }),
        materializedVia({ pcb_trace_id: TARGET_TRACE_ID }),
      ]),
    ).toEqual([END_ERROR])
  })

  test("accepts a via-in-pad stub whose lower end is a route via", () => {
    const circuitJson = targetCircuit({ layer: "inner1" }).filter(
      (element) =>
        element.type !== "pcb_trace" ||
        element.pcb_trace_id !== BRANCH_TRACE_ID,
    )
    circuitJson.push(
      trace({
        pcb_trace_id: BRANCH_TRACE_ID,
        route: [
          wirePoint({ x: 0, y: 0, layer: "top" }),
          viaPoint({
            from_layer: "top",
            to_layer: "bottom",
            outer_diameter: 0.4,
          }),
        ],
        source_trace_id: "source_trace_branch",
      }),
      materializedVia(),
    )
    expect(targetErrorIds(circuitJson)).toEqual([])
  })

  test("uses materialized via layers instead of a conflicting route span", () => {
    const circuitJson = targetCircuit({
      layer: "inner2",
      branchRoute: [viaPoint({ outer_diameter: 0.4 })],
    })
    expect(
      targetErrorIds([
        ...circuitJson,
        materializedVia({ layers: ["top", "inner1"] }),
      ]),
    ).toEqual([END_ERROR])
  })

  test("honors materialized via layers when only source-net identity is present", () => {
    const circuitJson = targetCircuit({
      layer: "inner2",
      branchRoute: [viaPoint({ outer_diameter: 0.4 })],
    })
    expect(
      targetErrorIds([
        ...circuitJson,
        materializedVia({
          pcb_trace_id: null,
          source_net_id: "source_net_a",
          layers: ["top", "inner1"],
        }),
      ]),
    ).toEqual([END_ERROR])
  })

  test("accepts via copper touching a rotated pad outside the via center", () => {
    const circuitJson = targetCircuit({ layer: "inner1" }).filter(
      (element) =>
        element.type !== "pcb_smtpad" ||
        element.pcb_port_id !== "pcb_port_via_anchor",
    )
    circuitJson.push({
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_rotated_anchor",
      pcb_port_id: "pcb_port_via_anchor",
      layer: "top",
      shape: "rotated_rect",
      x: 0.3,
      y: 0,
      width: 0.2,
      height: 0.2,
      ccw_rotation: 45,
    })
    expect(targetErrorIds([...circuitJson, materializedVia()])).toEqual([])
  })

  test("accepts onward same-net wire copper without a pad", () => {
    const circuitJson = targetCircuit({
      layer: "inner1",
      branchRoute: [wirePoint({ x: 0, y: -1 }), wirePoint({ x: 0, y: 1 })],
    }).filter(
      (element) =>
        element.type !== "pcb_smtpad" ||
        element.pcb_port_id !== "pcb_port_via_anchor",
    )
    circuitJson.push(materializedVia())
    const before = structuredClone(circuitJson)
    expect(targetErrorIds(circuitJson)).toEqual([])
    expect(circuitJson).toEqual(before)
  })

  test("rejects onward wire copper outside the via span", () => {
    const circuitJson = targetCircuit({
      layer: "inner1",
      branchRoute: [wirePoint({ x: 0, y: -1 }), wirePoint({ x: 0, y: 1 })],
    }).filter(
      (element) =>
        element.type !== "pcb_smtpad" ||
        element.pcb_port_id !== "pcb_port_via_anchor",
    )
    expect(
      targetErrorIds([
        ...circuitJson,
        materializedVia({ layers: ["inner1", "inner2"] }),
      ]),
    ).toEqual([END_ERROR])
  })

  test("uses port connectivity when routed traces have no source_trace_id", () => {
    const circuitJson = [
      board,
      sourceTrace("source_trace_ports", [
        "source_port_target",
        "source_port_branch",
      ]),
      {
        type: "pcb_port",
        pcb_port_id: "pcb_port_target",
        source_port_id: "source_port_target",
        x: -2,
        y: 0,
        layers: ["inner1"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "pcb_port_branch",
        source_port_id: "source_port_branch",
        x: 0,
        y: 0,
        layers: ["top"],
      },
      anchorPad({
        x: -2,
        y: 0,
        layer: "inner1",
        pcb_port_id: "pcb_port_target",
      }),
      anchorPad({ x: 0, y: 0, layer: "top", pcb_port_id: "pcb_port_branch" }),
      trace({
        pcb_trace_id: TARGET_TRACE_ID,
        route: [
          wirePoint({
            x: -2,
            y: 0,
            layer: "inner1",
            start_pcb_port_id: "pcb_port_target",
          }),
          wirePoint({
            x: 0,
            y: 0,
            layer: "inner1",
            end_pcb_port_id: "pcb_port_branch",
          }),
        ],
      }),
      trace({
        pcb_trace_id: BRANCH_TRACE_ID,
        route: [
          wirePoint({
            x: 0,
            y: 0,
            layer: "top",
            start_pcb_port_id: "pcb_port_branch",
            end_pcb_port_id: "pcb_port_branch",
          }),
          viaPoint({
            from_layer: "top",
            to_layer: "bottom",
            outer_diameter: 0.4,
          }),
        ],
      }),
      materializedVia(),
    ] satisfies AnyCircuitElement[]
    expect(targetErrorIds(circuitJson)).toEqual([])
  })
})

function withRouteVia({
  layer,
  via,
  endX = 0,
}: { layer: PcbLayer; via: ViaPoint; endX?: number }): AnyCircuitElement[] {
  return targetCircuit({ layer, endX, branchRoute: [via] })
}

describe("contact with a separate route-only via", () => {
  for (const layer of ["top", "inner1", "inner2", "bottom"] as const) {
    test(`accepts a through-via center on ${layer} without optional diameter`, () => {
      expect(targetErrorIds(withRouteVia({ layer, via: viaPoint() }))).toEqual(
        [],
      )
    })
  }

  test("uses explicit route-via diameter for noncentral copper contact", () => {
    expect(
      targetErrorIds(
        withRouteVia({
          layer: "inner2",
          via: viaPoint({
            from_layer: "top",
            to_layer: "bottom",
            outer_diameter: 0.4,
          }),
          endX: 0.3,
        }),
      ),
    ).toEqual([])
  })

  test("does not invent a diameter for a route-only via", () => {
    expect(
      targetErrorIds(
        withRouteVia({ layer: "inner2", via: viaPoint(), endX: 0.15 }),
      ),
    ).toEqual([END_ERROR])
  })

  test("accepts an inner-layer contact within a blind via span", () => {
    expect(
      targetErrorIds(
        withRouteVia({
          layer: "inner1",
          via: viaPoint({ from_layer: "top", to_layer: "inner1" }),
        }),
      ),
    ).toEqual([])
  })

  test("rejects an inner-layer contact outside a blind via span", () => {
    expect(
      targetErrorIds(
        withRouteVia({
          layer: "inner2",
          via: viaPoint({ from_layer: "top", to_layer: "inner1" }),
        }),
      ),
    ).toEqual([END_ERROR])
  })

  test("rejects a physically coincident route via on another net", () => {
    const circuitJson = withRouteVia({ layer: "inner1", via: viaPoint() })
    for (const element of circuitJson) {
      if (
        element.type === "source_trace" &&
        element.source_trace_id === "source_trace_branch"
      ) {
        element.connected_source_net_ids = ["source_net_other"]
      }
    }
    expect(targetErrorIds(circuitJson)).toEqual([END_ERROR])
  })

  test("continues reporting misaligned vias inside a route", () => {
    const circuitJson = [
      board,
      sourceTrace("source_trace_target"),
      anchorPad({ x: -2, y: 0, layer: "top" }),
      anchorPad({ x: 2, y: 0, layer: "bottom" }),
      trace({
        pcb_trace_id: TARGET_TRACE_ID,
        route: [
          wirePoint({ x: -2, y: 0, layer: "top" }),
          wirePoint({ x: 0, y: 0, layer: "top" }),
          viaPoint({ outer_diameter: 0.4, x: 0.1 }),
          wirePoint({ x: 0, y: 0, layer: "bottom" }),
          wirePoint({ x: 2, y: 0, layer: "bottom" }),
        ],
        source_trace_id: "source_trace_target",
      }),
    ] satisfies AnyCircuitElement[]
    expect(
      checkTracesAreContiguous(circuitJson).map(
        (error) => error.pcb_trace_error_id,
      ),
    ).toEqual(["misaligned_via_pcb_trace_target_2"])
  })
})
