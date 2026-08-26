import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkSourceNetsArePhysicallyConnected } from "lib/check-source-nets-are-physically-connected"
import { runAllRoutingChecks } from "lib/run-all-checks"
import {
  breakoutParentNetId,
  createBreakoutSourceNetCircuitJson,
  createPadlessViaSourceNetCircuitJson,
  createSplitSourceNetCircuitJson,
  padlessViaSourceNetId,
  splitSourceNetId,
} from "tests/fixtures/source-net-physical-connectivity"

test("reports a four-port source net split into two copper groups", async () => {
  const circuitJson = createSplitSourceNetCircuitJson()
  const errors = checkSourceNetsArePhysicallyConnected(circuitJson)

  expect(errors).toEqual([
    expect.objectContaining({
      type: "pcb_trace_error",
      pcb_trace_error_id: `disconnected_copper_groups_${splitSourceNetId}`,
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
  expect(await runAllRoutingChecks(circuitJson)).toContainEqual(
    expect.objectContaining({
      pcb_trace_error_id: `disconnected_copper_groups_${splitSourceNetId}`,
    }),
  )

  const bridgeTrace: AnyCircuitElement = {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_bridge",
    source_trace_id: splitSourceNetId,
    route: [
      { route_type: "wire", x: -3, y: 0, width: 0.2, layer: "top" },
      { route_type: "wire", x: 3, y: 0, width: 0.2, layer: "top" },
    ],
  }
  expect(
    checkSourceNetsArePhysicallyConnected([...circuitJson, bridgeTrace]),
  ).toHaveLength(0)

  const connectingPour: AnyCircuitElement = {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "pcb_copper_pour_split_net",
    source_net_id: splitSourceNetId,
    shape: "rect",
    center: { x: 0, y: 0 },
    width: 14,
    height: 2,
    layer: "top",
    covered_with_solder_mask: true,
  }
  expect(
    checkSourceNetsArePhysicallyConnected([...circuitJson, connectingPour]),
  ).toHaveLength(0)

  const isolatedPour: AnyCircuitElement = {
    ...connectingPour,
    pcb_copper_pour_id: "pcb_copper_pour_isolated",
    center: { x: 0, y: 10 },
  }
  expect(
    checkSourceNetsArePhysicallyConnected([...circuitJson, isolatedPour]),
  ).toContainEqual(
    expect.objectContaining({
      pcb_trace_error_id: `disconnected_copper_groups_${splitSourceNetId}`,
    }),
  )
})

test("treats traces meeting through a breakout point as one copper group", () => {
  const circuitJson = createBreakoutSourceNetCircuitJson()
  expect(checkSourceNetsArePhysicallyConnected(circuitJson)).toHaveLength(0)

  const parentTrace = circuitJson.find(
    (element): element is PcbTrace =>
      element.type === "pcb_trace" &&
      element.pcb_trace_id === "pcb_trace_parent",
  )
  if (!parentTrace) throw new Error("missing parent PCB trace")

  const disconnectedParentTrace: PcbTrace = {
    ...parentTrace,
    route: parentTrace.route.map((point, index) =>
      index === parentTrace.route.length - 1 && point.route_type === "wire"
        ? { ...point, x: 0.2 }
        : point,
    ),
  }
  const disconnectedCircuitJson = circuitJson.map((element) =>
    element === parentTrace ? disconnectedParentTrace : element,
  )
  expect(
    checkSourceNetsArePhysicallyConnected(disconnectedCircuitJson),
  ).toContainEqual(
    expect.objectContaining({
      pcb_trace_error_id: `disconnected_copper_groups_${breakoutParentNetId}`,
    }),
  )
})

test("uses geometry rather than endpoint ids for padless via ports", () => {
  const circuitJson = createPadlessViaSourceNetCircuitJson()
  expect(checkSourceNetsArePhysicallyConnected(circuitJson)).toHaveLength(0)

  const traceWithoutViaPortId = circuitJson.map((element) => {
    if (element.type !== "pcb_trace") return element
    return {
      ...element,
      route: element.route.map((point) => {
        if (point.route_type !== "wire" || !point.end_pcb_port_id) return point
        const { end_pcb_port_id: _endPcbPortId, ...pointWithoutPortId } = point
        return pointWithoutPortId
      }),
    }
  })
  expect(
    checkSourceNetsArePhysicallyConnected(traceWithoutViaPortId),
  ).toHaveLength(0)

  const traceWithStaleViaPortId = circuitJson.map((element) => {
    if (element.type !== "pcb_trace") return element
    return {
      ...element,
      route: element.route.map((point) =>
        point.route_type === "wire" && point.end_pcb_port_id
          ? { ...point, x: 10, y: 10 }
          : point,
      ),
    }
  })
  expect(
    checkSourceNetsArePhysicallyConnected(traceWithStaleViaPortId),
  ).toContainEqual(
    expect.objectContaining({
      pcb_trace_error_id: `disconnected_copper_groups_${padlessViaSourceNetId}`,
    }),
  )
})
