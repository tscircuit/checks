import { describe, expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbTrace,
  PcbVia,
} from "circuit-json"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"

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

function sourceTrace(sourceTraceId: string, sourceNetId = "source_net_a") {
  return {
    type: "source_trace" as const,
    source_trace_id: sourceTraceId,
    connected_source_port_ids: [],
    connected_source_net_ids: [sourceNetId],
  }
}

function wirePoint(
  x: number,
  y: number,
  layer: PcbLayer = "top",
  width = 0.2,
): WirePoint {
  return { route_type: "wire", x, y, layer, width }
}

function viaPoint(
  fromLayer: PcbLayer = "top",
  toLayer: PcbLayer = "bottom",
  diameter?: number,
): ViaPoint {
  return {
    route_type: "via",
    x: 0,
    y: 0,
    from_layer: fromLayer,
    to_layer: toLayer,
    ...(diameter === undefined ? {} : { outer_diameter: diameter }),
  }
}

function trace(
  pcbTraceId: string,
  route: RoutePoint[],
  sourceTraceId?: string,
): PcbTrace {
  return {
    type: "pcb_trace",
    pcb_trace_id: pcbTraceId,
    route,
    ...(sourceTraceId === undefined ? {} : { source_trace_id: sourceTraceId }),
  }
}

function anchorPad(x: number, y: number, layer: PcbLayer = "top") {
  return {
    type: "pcb_smtpad" as const,
    pcb_smtpad_id: `pcb_smtpad_anchor_${x}_${y}_${layer}`,
    pcb_port_id: `pcb_port_anchor_${x}_${y}_${layer}`,
    shape: "rect" as const,
    x,
    y,
    width: 0.3,
    height: 0.3,
    layer,
  }
}

function materializedVia(overrides: Partial<PcbVia> = {}): PcbVia {
  return {
    type: "pcb_via",
    pcb_via_id: "pcb_via_branch",
    pcb_trace_id: BRANCH_TRACE_ID,
    x: 0,
    y: 0,
    hole_diameter: 0.2,
    outer_diameter: 0.4,
    layers: ["top", "inner1", "inner2", "bottom"],
    ...overrides,
  }
}

function targetCircuit(
  layer: PcbLayer = "top",
  endX = 0,
  viaAnchorLayer: PcbLayer = layer === "top" ? "bottom" : "top",
): AnyCircuitElement[] {
  return [
    board,
    sourceTrace("source_trace_target"),
    {
      ...sourceTrace("source_trace_branch"),
      connected_source_port_ids: ["source_port_via_anchor"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_via_anchor",
      source_port_id: "source_port_via_anchor",
      x: 0,
      y: 0,
      layers: [viaAnchorLayer],
    },
    { ...anchorPad(0, 0, viaAnchorLayer), pcb_port_id: "pcb_port_via_anchor" },
    anchorPad(-2, 0, layer),
    trace(
      TARGET_TRACE_ID,
      [wirePoint(-2, 0, layer), wirePoint(endX, 0, layer)],
      "source_trace_target",
    ),
    trace(BRANCH_TRACE_ID, [], "source_trace_branch"),
  ]
}

function targetErrorIds(circuitJson: AnyCircuitElement[]) {
  return checkTracesAreContiguous(circuitJson)
    .filter((error) => error.pcb_trace_id === TARGET_TRACE_ID)
    .map((error) => error.pcb_trace_error_id)
}

describe("net-level wire endpoints contacting separate via copper", () => {
  for (const layer of ["top", "inner1", "inner2", "bottom"] as const) {
    test(`accepts materialized through-via contact on ${layer}`, () => {
      expect(
        targetErrorIds([...targetCircuit(layer), materializedVia()]),
      ).toEqual([])
    })
  }

  test("accepts a via linked directly to the shared source net", () => {
    expect(
      targetErrorIds([
        ...targetCircuit("inner1"),
        materializedVia({
          pcb_trace_id: undefined,
          source_net_id: "source_net_a",
        }),
      ]),
    ).toEqual([])
  })

  test("accepts contact at the combined trace and via copper radii", () => {
    expect(
      targetErrorIds([...targetCircuit("inner1", 0.3), materializedVia()]),
    ).toEqual([])
  })

  test("rejects a copper-radius near miss", () => {
    expect(
      targetErrorIds([
        ...targetCircuit("inner1", 0.300000002),
        materializedVia(),
      ]),
    ).toEqual([END_ERROR])
  })

  test("rejects a via on a different source net", () => {
    expect(
      targetErrorIds([
        ...targetCircuit("inner1"),
        materializedVia({
          pcb_trace_id: undefined,
          source_net_id: "source_net_other",
        }),
      ]),
    ).toEqual([END_ERROR])
  })

  test("rejects an unlinked via with no known logical net", () => {
    expect(
      targetErrorIds([
        ...targetCircuit("inner1"),
        materializedVia({ pcb_trace_id: undefined }),
      ]),
    ).toEqual([END_ERROR])
  })

  test("rejects contact on a layer outside a buried via span", () => {
    expect(
      targetErrorIds([
        ...targetCircuit("top"),
        materializedVia({ layers: ["inner1", "inner2"] }),
      ]),
    ).toEqual([END_ERROR])
  })

  test("accepts a buried via on its declared copper layers", () => {
    expect(
      targetErrorIds([
        ...targetCircuit("inner2", 0, "inner1"),
        materializedVia({ layers: ["inner1", "inner2"] }),
      ]),
    ).toEqual([])
  })

  test("rejects an isolated same-net via with no onward copper", () => {
    const circuitJson = targetCircuit("inner1").filter(
      (el) =>
        el.type !== "pcb_smtpad" || el.pcb_port_id !== "pcb_port_via_anchor",
    )
    expect(targetErrorIds([...circuitJson, materializedVia()])).toEqual([
      END_ERROR,
    ])
  })

  test("does not use a top pad as onward copper for a buried via", () => {
    expect(
      targetErrorIds([
        ...targetCircuit("inner2"),
        materializedVia({ layers: ["inner1", "inner2"] }),
      ]),
    ).toEqual([END_ERROR])
  })

  test("rejects a remote via even when it belongs to the same logical net", () => {
    expect(
      targetErrorIds([
        ...targetCircuit("inner1"),
        materializedVia({ x: 2, y: 2 }),
      ]),
    ).toEqual([END_ERROR])
  })

  test("does not use a trace's own via to excuse its dangling endpoint", () => {
    expect(
      targetErrorIds([
        ...targetCircuit("inner1"),
        materializedVia({ pcb_trace_id: TARGET_TRACE_ID }),
      ]),
    ).toEqual([END_ERROR])
  })

  test("accepts a via-in-pad stub whose lower end is a route via", () => {
    const circuitJson = targetCircuit("inner1").filter(
      (el) => el.type !== "pcb_trace" || el.pcb_trace_id !== BRANCH_TRACE_ID,
    )
    circuitJson.push(
      trace(
        BRANCH_TRACE_ID,
        [wirePoint(0, 0, "top"), viaPoint("top", "bottom", 0.4)],
        "source_trace_branch",
      ),
      materializedVia(),
    )
    expect(targetErrorIds(circuitJson)).toEqual([])
  })

  test("uses materialized via layers instead of a conflicting route span", () => {
    const circuitJson = targetCircuit("inner2").map((el) =>
      el.type === "pcb_trace" && el.pcb_trace_id === BRANCH_TRACE_ID
        ? { ...el, route: [viaPoint("top", "bottom", 0.4)] }
        : el,
    )
    expect(
      targetErrorIds([
        ...circuitJson,
        materializedVia({ layers: ["top", "inner1"] }),
      ]),
    ).toEqual([END_ERROR])
  })

  test("honors materialized via layers when only source-net identity is present", () => {
    const circuitJson = targetCircuit("inner2").map((el) =>
      el.type === "pcb_trace" && el.pcb_trace_id === BRANCH_TRACE_ID
        ? { ...el, route: [viaPoint("top", "bottom", 0.4)] }
        : el,
    )
    expect(
      targetErrorIds([
        ...circuitJson,
        materializedVia({
          pcb_trace_id: undefined,
          source_net_id: "source_net_a",
          layers: ["top", "inner1"],
        }),
      ]),
    ).toEqual([END_ERROR])
  })

  test("accepts via copper touching a rotated pad outside the via center", () => {
    const circuitJson = targetCircuit("inner1").map((el) =>
      el.type === "pcb_smtpad" && el.pcb_port_id === "pcb_port_via_anchor"
        ? {
            ...el,
            shape: "rotated_rect" as const,
            x: 0.3,
            y: 0,
            width: 0.2,
            height: 0.2,
            ccw_rotation: 45,
          }
        : el,
    )
    expect(targetErrorIds([...circuitJson, materializedVia()])).toEqual([])
  })

  test("accepts onward same-net wire copper without a pad", () => {
    const circuitJson = targetCircuit("inner1")
      .filter(
        (el) =>
          el.type !== "pcb_smtpad" || el.pcb_port_id !== "pcb_port_via_anchor",
      )
      .map((el) =>
        el.type === "pcb_trace" && el.pcb_trace_id === BRANCH_TRACE_ID
          ? { ...el, route: [wirePoint(0, -1, "top"), wirePoint(0, 1, "top")] }
          : el,
      )
    circuitJson.push(materializedVia())
    const before = structuredClone(circuitJson)
    expect(targetErrorIds(circuitJson)).toEqual([])
    expect(circuitJson).toEqual(before)
  })

  test("rejects onward wire copper outside the via span", () => {
    const circuitJson = targetCircuit("inner1")
      .filter(
        (el) =>
          el.type !== "pcb_smtpad" || el.pcb_port_id !== "pcb_port_via_anchor",
      )
      .map((el) =>
        el.type === "pcb_trace" && el.pcb_trace_id === BRANCH_TRACE_ID
          ? { ...el, route: [wirePoint(0, -1, "top"), wirePoint(0, 1, "top")] }
          : el,
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
      {
        ...sourceTrace("source_trace_ports"),
        connected_source_port_ids: ["source_port_target", "source_port_branch"],
      },
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
      { ...anchorPad(-2, 0, "inner1"), pcb_port_id: "pcb_port_target" },
      { ...anchorPad(0, 0, "top"), pcb_port_id: "pcb_port_branch" },
      trace(TARGET_TRACE_ID, [
        { ...wirePoint(-2, 0, "inner1"), start_pcb_port_id: "pcb_port_target" },
        { ...wirePoint(0, 0, "inner1"), end_pcb_port_id: "pcb_port_branch" },
      ]),
      trace(BRANCH_TRACE_ID, [
        {
          ...wirePoint(0, 0, "top"),
          start_pcb_port_id: "pcb_port_branch",
          end_pcb_port_id: "pcb_port_branch",
        },
        viaPoint("top", "bottom", 0.4),
      ]),
      materializedVia(),
    ] satisfies AnyCircuitElement[]
    expect(targetErrorIds(circuitJson)).toEqual([])
  })
})

describe("contact with a separate route-only via", () => {
  function withRouteVia(
    layer: PcbLayer,
    point: ViaPoint,
    endX = 0,
  ): AnyCircuitElement[] {
    return targetCircuit(layer, endX).map((el) =>
      el.type === "pcb_trace" && el.pcb_trace_id === BRANCH_TRACE_ID
        ? { ...el, route: [point] }
        : el,
    )
  }

  for (const layer of ["top", "inner1", "inner2", "bottom"] as const) {
    test(`accepts a through-via center on ${layer} without optional diameter`, () => {
      expect(targetErrorIds(withRouteVia(layer, viaPoint()))).toEqual([])
    })
  }

  test("uses explicit route-via diameter for noncentral copper contact", () => {
    expect(
      targetErrorIds(
        withRouteVia("inner2", viaPoint("top", "bottom", 0.4), 0.3),
      ),
    ).toEqual([])
  })

  test("does not invent a diameter for a route-only via", () => {
    expect(targetErrorIds(withRouteVia("inner2", viaPoint(), 0.15))).toEqual([
      END_ERROR,
    ])
  })

  test("accepts an inner-layer contact within a blind via span", () => {
    expect(
      targetErrorIds(withRouteVia("inner1", viaPoint("top", "inner1"))),
    ).toEqual([])
  })

  test("rejects an inner-layer contact outside a blind via span", () => {
    expect(
      targetErrorIds(withRouteVia("inner2", viaPoint("top", "inner1"))),
    ).toEqual([END_ERROR])
  })

  test("rejects a physically coincident route via on another net", () => {
    const circuitJson = withRouteVia("inner1", viaPoint()).map((el) =>
      el.type === "source_trace" && el.source_trace_id === "source_trace_branch"
        ? { ...el, connected_source_net_ids: ["source_net_other"] }
        : el,
    )
    expect(targetErrorIds(circuitJson)).toEqual([END_ERROR])
  })

  test("continues reporting misaligned vias inside a route", () => {
    const circuitJson = [
      board,
      sourceTrace("source_trace_target"),
      anchorPad(-2, 0, "top"),
      anchorPad(2, 0, "bottom"),
      trace(
        TARGET_TRACE_ID,
        [
          wirePoint(-2, 0, "top"),
          wirePoint(0, 0, "top"),
          { ...viaPoint("top", "bottom", 0.4), x: 0.1 },
          wirePoint(0, 0, "bottom"),
          wirePoint(2, 0, "bottom"),
        ],
        "source_trace_target",
      ),
    ] satisfies AnyCircuitElement[]
    expect(targetErrorIds(circuitJson)).toEqual([
      "misaligned_via_pcb_trace_target_2",
    ])
  })
})
