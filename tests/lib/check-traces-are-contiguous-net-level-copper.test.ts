import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"

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

function wirePoint(
  x: number,
  y: number,
  layer: PcbLayer = "top",
  width = 0.2,
): WirePoint {
  return { route_type: "wire", x, y, layer, width } as WirePoint
}

function trace(
  pcbTraceId: string,
  sourceTraceId: string,
  route: WirePoint[],
  routeThicknessMode?: PcbTrace["route_thickness_mode"],
) {
  return {
    type: "pcb_trace" as const,
    pcb_trace_id: pcbTraceId,
    source_trace_id: sourceTraceId,
    route,
    ...(routeThicknessMode ? { route_thickness_mode: routeThicknessMode } : {}),
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

function targetEndpointErrorIds(circuitJson: AnyCircuitElement[]) {
  return checkTracesAreContiguous(circuitJson)
    .filter((error) => error.pcb_trace_id === TARGET_TRACE_ID)
    .map((error) => error.pcb_trace_error_id)
}

describe("net-level endpoints touching logically connected trace copper", () => {
  test("accepts a same-layer T-junction into another trace segment", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad(-2, 0),
      trace(TARGET_TRACE_ID, "source_trace_a", [
        wirePoint(-2, 0),
        wirePoint(0, 0),
      ]),
      trace("pcb_trace_branch", "source_trace_a", [
        wirePoint(0, -1),
        wirePoint(0, 1),
      ]),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([])
  })

  test("accepts distinct source traces joined through a shared source net", () => {
    const circuitJson = [
      sourceTrace("source_trace_target", "source_net_shared"),
      sourceTrace("source_trace_branch", "source_net_shared"),
      anchorPad(-2, 0),
      trace(TARGET_TRACE_ID, "source_trace_target", [
        wirePoint(-2, 0),
        wirePoint(0, 0),
      ]),
      trace("pcb_trace_branch", "source_trace_branch", [
        wirePoint(0, -1),
        wirePoint(0, 1),
      ]),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([])
  })

  test("rejects touching copper on another layer", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad(-2, 0),
      trace(TARGET_TRACE_ID, "source_trace_a", [
        wirePoint(-2, 0),
        wirePoint(0, 0),
      ]),
      trace("pcb_trace_bottom", "source_trace_a", [
        wirePoint(0, -1, "bottom"),
        wirePoint(0, 1, "bottom"),
      ]),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })

  test("rejects touching copper on another logical net", () => {
    const circuitJson = [
      sourceTrace("source_trace_target", "source_net_target"),
      sourceTrace("source_trace_other", "source_net_other"),
      anchorPad(-2, 0),
      trace(TARGET_TRACE_ID, "source_trace_target", [
        wirePoint(-2, 0),
        wirePoint(0, 0),
      ]),
      trace("pcb_trace_other", "source_trace_other", [
        wirePoint(0, -1),
        wirePoint(0, 1),
      ]),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })

  test("rejects a copper-radius near miss", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad(0, 1),
      trace(TARGET_TRACE_ID, "source_trace_a", [
        wirePoint(0, 1),
        wirePoint(0, 0.200000002),
      ]),
      trace("pcb_trace_branch", "source_trace_a", [
        wirePoint(-1, 0),
        wirePoint(1, 0),
      ]),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })

  test("uses the incoming constant segment width at the end endpoint", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad(-2, 0),
      trace(
        TARGET_TRACE_ID,
        "source_trace_a",
        [wirePoint(-2, 0, "top", 0.1), wirePoint(0, 0, "top", 1)],
        "constant",
      ),
      trace("pcb_trace_branch", "source_trace_a", [
        wirePoint(-1, 0.4, "top", 0.1),
        wirePoint(1, 0.4, "top", 0.1),
      ]),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })

  test("accepts end contact from a wide incoming constant segment", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad(-2, 0),
      trace(
        TARGET_TRACE_ID,
        "source_trace_a",
        [wirePoint(-2, 0, "top", 1), wirePoint(0, 0, "top", 0.1)],
        "constant",
      ),
      trace("pcb_trace_branch", "source_trace_a", [
        wirePoint(-1, 0.4, "top", 0.1),
        wirePoint(1, 0.4, "top", 0.1),
      ]),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([])
  })

  test("does not suppress endpoints on an interpolated owner trace", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad(-2, 0),
      trace(
        TARGET_TRACE_ID,
        "source_trace_a",
        [wirePoint(-2, 0, "top", 0.1), wirePoint(0, 0, "top", 1)],
        "interpolated",
      ),
      trace("pcb_trace_branch", "source_trace_a", [
        wirePoint(-1, 0.4, "top", 0.1),
        wirePoint(1, 0.4, "top", 0.1),
      ]),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })

  test("does not use interpolated traces as contact candidates", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad(-2, 0),
      trace(TARGET_TRACE_ID, "source_trace_a", [
        wirePoint(-2, 0),
        wirePoint(0, 0),
      ]),
      trace(
        "pcb_trace_interpolated_branch",
        "source_trace_a",
        [wirePoint(0, -1), wirePoint(0, 1)],
        "interpolated",
      ),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })

  test("does not use a zero-length trace segment as endpoint contact", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad(-2, 0),
      trace(TARGET_TRACE_ID, "source_trace_a", [
        wirePoint(-2, 0),
        wirePoint(0, 0),
      ]),
      trace("pcb_trace_zero_length", "source_trace_a", [
        wirePoint(0, 0),
        wirePoint(0, 0),
      ]),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })

  test("walks past a zero-length owner segment to the incoming copper", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad(-2, 0),
      trace(TARGET_TRACE_ID, "source_trace_a", [
        wirePoint(-2, 0),
        wirePoint(0, 0),
        wirePoint(0, 0),
      ]),
      trace("pcb_trace_branch", "source_trace_a", [
        wirePoint(0, -1),
        wirePoint(0, 1),
      ]),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([])
  })

  test("does not suppress an all-degenerate owner trace", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      trace(TARGET_TRACE_ID, "source_trace_a", [
        wirePoint(0, 0),
        wirePoint(0, 0),
        wirePoint(0, 0),
      ]),
      trace("pcb_trace_branch", "source_trace_a", [
        wirePoint(0, -1),
        wirePoint(0, 1),
      ]),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_start",
    ])
  })

  test("checks the two endpoints of a very short trace independently", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      trace(TARGET_TRACE_ID, "source_trace_a", [
        wirePoint(0, 0, "top", 0.0001),
        wirePoint(0.0005, 0, "top", 0.0001),
      ]),
      trace("pcb_trace_branch", "source_trace_a", [
        wirePoint(0, -1, "top", 0.0001),
        wirePoint(0, 1, "top", 0.0001),
      ]),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })

  test("reports a coincident closed-trace endpoint only once", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      trace(TARGET_TRACE_ID, "source_trace_a", [
        wirePoint(0, 0),
        wirePoint(1, 0),
        wirePoint(0, 0),
      ]),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_start",
    ])
  })

  test("does not deduplicate coincident endpoints on different layers", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      trace(TARGET_TRACE_ID, "source_trace_a", [
        wirePoint(0, 0, "top"),
        wirePoint(0, 0, "bottom"),
      ]),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_start",
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })

  test("does not use contact elsewhere along the owner trace for its floating endpoint", () => {
    const circuitJson = [
      sourceTrace("source_trace_a"),
      anchorPad(-2, 0),
      trace(TARGET_TRACE_ID, "source_trace_a", [
        wirePoint(-2, 0),
        wirePoint(0, 0),
      ]),
      trace("pcb_trace_branch", "source_trace_a", [
        wirePoint(-1, -1),
        wirePoint(-1, 1),
      ]),
    ] satisfies AnyCircuitElement[]

    expect(targetEndpointErrorIds(circuitJson)).toEqual([
      "disconnected_endpoint_pcb_trace_target_end",
    ])
  })
})
