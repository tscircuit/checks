import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { checkDanglingTraces } from "lib/check-dangling-traces/check-dangling-traces"

const TARGET_TRACE_ID = "pcb_trace_target"

type WirePoint = Extract<PcbTrace["route"][number], { route_type: "wire" }>
type PcbLayer = WirePoint["layer"]

function sourceTrace(sourceTraceId: string, sourceNetId = "source_net_a") {
  return {
    type: "source_trace" as const,
    source_trace_id: sourceTraceId,
    connected_source_port_ids: [],
    connected_source_net_ids: [sourceNetId],
  }
}

function wirePoint({
  x,
  y,
  layer = "top",
  width = 0.2,
}: {
  x: number
  y: number
  layer?: PcbLayer
  width?: number
}): WirePoint {
  return {
    route_type: "wire",
    x,
    y,
    layer,
    width,
  }
}

function trace({
  pcb_trace_id,
  source_trace_id,
  route,
  route_thickness_mode,
}: {
  pcb_trace_id: string
  source_trace_id?: string
  route: PcbTrace["route"]
  route_thickness_mode?: PcbTrace["route_thickness_mode"]
}): PcbTrace {
  return {
    type: "pcb_trace",
    pcb_trace_id,
    source_trace_id,
    route,
    route_thickness_mode,
  }
}

function anchorPad({
  x,
  y,
  layer = "top",
}: {
  x: number
  y: number
  layer?: PcbLayer
}) {
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

function targetEndpointErrorIds(circuitJson: AnyCircuitElement[]) {
  return checkDanglingTraces(circuitJson)
    .filter((error) => error.pcb_trace_id === TARGET_TRACE_ID)
    .map((error) => error.pcb_trace_error_id)
}

describe("net-level endpoints touching logically connected trace copper", () => {
  test("accepts a same-layer T-junction into another trace segment", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad({ x: -2, y: 0 }),
      trace({
        pcb_trace_id: TARGET_TRACE_ID,
        source_trace_id: "source_trace_a",
        route: [wirePoint({ x: -2, y: 0 }), wirePoint({ x: 0, y: 0 })],
      }),
      trace({
        pcb_trace_id: "pcb_trace_branch",
        source_trace_id: "source_trace_a",
        route: [wirePoint({ x: 0, y: -1 }), wirePoint({ x: 0, y: 1 })],
      }),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([])
  })

  test("accepts distinct source traces joined through a shared source net", () => {
    const circuitJson = [
      sourceTrace("source_trace_target", "source_net_shared"),
      sourceTrace("source_trace_branch", "source_net_shared"),
      anchorPad({ x: -2, y: 0 }),
      trace({
        pcb_trace_id: TARGET_TRACE_ID,
        source_trace_id: "source_trace_target",
        route: [wirePoint({ x: -2, y: 0 }), wirePoint({ x: 0, y: 0 })],
      }),
      trace({
        pcb_trace_id: "pcb_trace_branch",
        source_trace_id: "source_trace_branch",
        route: [wirePoint({ x: 0, y: -1 }), wirePoint({ x: 0, y: 1 })],
      }),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([])
  })

  test("rejects touching copper on another layer", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad({ x: -2, y: 0 }),
      trace({
        pcb_trace_id: TARGET_TRACE_ID,
        source_trace_id: "source_trace_a",
        route: [wirePoint({ x: -2, y: 0 }), wirePoint({ x: 0, y: 0 })],
      }),
      trace({
        pcb_trace_id: "pcb_trace_bottom",
        source_trace_id: "source_trace_a",
        route: [
          wirePoint({ x: 0, y: -1, layer: "bottom" }),
          wirePoint({ x: 0, y: 1, layer: "bottom" }),
        ],
      }),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })

  test("rejects touching copper on another logical net", () => {
    const circuitJson = [
      sourceTrace("source_trace_target", "source_net_target"),
      sourceTrace("source_trace_other", "source_net_other"),
      anchorPad({ x: -2, y: 0 }),
      trace({
        pcb_trace_id: TARGET_TRACE_ID,
        source_trace_id: "source_trace_target",
        route: [wirePoint({ x: -2, y: 0 }), wirePoint({ x: 0, y: 0 })],
      }),
      trace({
        pcb_trace_id: "pcb_trace_other",
        source_trace_id: "source_trace_other",
        route: [wirePoint({ x: 0, y: -1 }), wirePoint({ x: 0, y: 1 })],
      }),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })

  test("rejects a copper-radius near miss", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad({ x: 0, y: 1 }),
      trace({
        pcb_trace_id: TARGET_TRACE_ID,
        source_trace_id: "source_trace_a",
        route: [wirePoint({ x: 0, y: 1 }), wirePoint({ x: 0, y: 0.200000002 })],
      }),
      trace({
        pcb_trace_id: "pcb_trace_branch",
        source_trace_id: "source_trace_a",
        route: [wirePoint({ x: -1, y: 0 }), wirePoint({ x: 1, y: 0 })],
      }),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })

  test("uses the incoming constant segment width at the end endpoint", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad({ x: -2, y: 0 }),
      trace({
        pcb_trace_id: TARGET_TRACE_ID,
        source_trace_id: "source_trace_a",
        route: [
          wirePoint({ x: -2, y: 0, layer: "top", width: 0.1 }),
          wirePoint({ x: 0, y: 0, layer: "top", width: 1 }),
        ],
        route_thickness_mode: "constant",
      }),
      trace({
        pcb_trace_id: "pcb_trace_branch",
        source_trace_id: "source_trace_a",
        route: [
          wirePoint({ x: -1, y: 0.4, layer: "top", width: 0.1 }),
          wirePoint({ x: 1, y: 0.4, layer: "top", width: 0.1 }),
        ],
      }),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })

  test("accepts end contact from a wide incoming constant segment", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad({ x: -2, y: 0 }),
      trace({
        pcb_trace_id: TARGET_TRACE_ID,
        source_trace_id: "source_trace_a",
        route: [
          wirePoint({ x: -2, y: 0, layer: "top", width: 1 }),
          wirePoint({ x: 0, y: 0, layer: "top", width: 0.1 }),
        ],
        route_thickness_mode: "constant",
      }),
      trace({
        pcb_trace_id: "pcb_trace_branch",
        source_trace_id: "source_trace_a",
        route: [
          wirePoint({ x: -1, y: 0.4, layer: "top", width: 0.1 }),
          wirePoint({ x: 1, y: 0.4, layer: "top", width: 0.1 }),
        ],
      }),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([])
  })

  test("does not suppress endpoints on an interpolated owner trace", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad({ x: -2, y: 0 }),
      trace({
        pcb_trace_id: TARGET_TRACE_ID,
        source_trace_id: "source_trace_a",
        route: [
          wirePoint({ x: -2, y: 0, layer: "top", width: 0.1 }),
          wirePoint({ x: 0, y: 0, layer: "top", width: 1 }),
        ],
        route_thickness_mode: "interpolated",
      }),
      trace({
        pcb_trace_id: "pcb_trace_branch",
        source_trace_id: "source_trace_a",
        route: [
          wirePoint({ x: -1, y: 0.4, layer: "top", width: 0.1 }),
          wirePoint({ x: 1, y: 0.4, layer: "top", width: 0.1 }),
        ],
      }),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })

  test("does not use interpolated traces as contact candidates", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad({ x: -2, y: 0 }),
      trace({
        pcb_trace_id: TARGET_TRACE_ID,
        source_trace_id: "source_trace_a",
        route: [wirePoint({ x: -2, y: 0 }), wirePoint({ x: 0, y: 0 })],
      }),
      trace({
        pcb_trace_id: "pcb_trace_interpolated_branch",
        source_trace_id: "source_trace_a",
        route: [wirePoint({ x: 0, y: -1 }), wirePoint({ x: 0, y: 1 })],
        route_thickness_mode: "interpolated",
      }),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })

  test("does not use a zero-length trace segment as endpoint contact", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad({ x: -2, y: 0 }),
      trace({
        pcb_trace_id: TARGET_TRACE_ID,
        source_trace_id: "source_trace_a",
        route: [wirePoint({ x: -2, y: 0 }), wirePoint({ x: 0, y: 0 })],
      }),
      trace({
        pcb_trace_id: "pcb_trace_zero_length",
        source_trace_id: "source_trace_a",
        route: [wirePoint({ x: 0, y: 0 }), wirePoint({ x: 0, y: 0 })],
      }),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })

  test("walks past a zero-length owner segment to the incoming copper", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad({ x: -2, y: 0 }),
      trace({
        pcb_trace_id: TARGET_TRACE_ID,
        source_trace_id: "source_trace_a",
        route: [
          wirePoint({ x: -2, y: 0 }),
          wirePoint({ x: 0, y: 0 }),
          wirePoint({ x: 0, y: 0 }),
        ],
      }),
      trace({
        pcb_trace_id: "pcb_trace_branch",
        source_trace_id: "source_trace_a",
        route: [wirePoint({ x: 0, y: -1 }), wirePoint({ x: 0, y: 1 })],
      }),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([])
  })

  test("does not suppress an all-degenerate owner trace", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      trace({
        pcb_trace_id: TARGET_TRACE_ID,
        source_trace_id: "source_trace_a",
        route: [
          wirePoint({ x: 0, y: 0 }),
          wirePoint({ x: 0, y: 0 }),
          wirePoint({ x: 0, y: 0 }),
        ],
      }),
      trace({
        pcb_trace_id: "pcb_trace_branch",
        source_trace_id: "source_trace_a",
        route: [wirePoint({ x: 0, y: -1 }), wirePoint({ x: 0, y: 1 })],
      }),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_start",
    ])
  })

  test("checks the two endpoints of a very short trace independently", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      trace({
        pcb_trace_id: TARGET_TRACE_ID,
        source_trace_id: "source_trace_a",
        route: [
          wirePoint({ x: 0, y: 0, layer: "top", width: 0.0001 }),
          wirePoint({ x: 0.0005, y: 0, layer: "top", width: 0.0001 }),
        ],
      }),
      trace({
        pcb_trace_id: "pcb_trace_branch",
        source_trace_id: "source_trace_a",
        route: [
          wirePoint({ x: 0, y: -1, layer: "top", width: 0.0001 }),
          wirePoint({ x: 0, y: 1, layer: "top", width: 0.0001 }),
        ],
      }),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })

  test("reports a coincident closed-trace endpoint only once", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      trace({
        pcb_trace_id: TARGET_TRACE_ID,
        source_trace_id: "source_trace_a",
        route: [
          wirePoint({ x: 0, y: 0 }),
          wirePoint({ x: 1, y: 0 }),
          wirePoint({ x: 0, y: 0 }),
        ],
      }),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_start",
    ])
  })

  test("does not deduplicate coincident endpoints on different layers", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      trace({
        pcb_trace_id: TARGET_TRACE_ID,
        source_trace_id: "source_trace_a",
        route: [
          wirePoint({ x: 0, y: 0, layer: "top" }),
          wirePoint({ x: 0, y: 0, layer: "bottom" }),
        ],
      }),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_start",
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })

  test("does not use contact elsewhere along the owner trace for its floating endpoint", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad({ x: -2, y: 0 }),
      trace({
        pcb_trace_id: TARGET_TRACE_ID,
        source_trace_id: "source_trace_a",
        route: [wirePoint({ x: -2, y: 0 }), wirePoint({ x: 0, y: 0 })],
      }),
      trace({
        pcb_trace_id: "pcb_trace_branch",
        source_trace_id: "source_trace_a",
        route: [wirePoint({ x: -1, y: -1 }), wirePoint({ x: -1, y: 1 })],
      }),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })
})
