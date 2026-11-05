import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  PcbCopperPour,
  PcbSmtPad,
  PcbTrace,
  PcbVia,
} from "circuit-json"
import { checkDanglingTraces } from "lib/check-dangling-traces/check-dangling-traces"
import { runAllRoutingChecks } from "lib/run-all-checks"

type RoutePoint = PcbTrace["route"][number]

const wire = (x: number, y: number, layer: "top" | "bottom" = "top") =>
  ({ route_type: "wire", x, y, layer, width: 0.2 }) as RoutePoint

const viaPoint = (x: number, y: number) =>
  ({
    route_type: "via",
    x,
    y,
    from_layer: "top",
    to_layer: "bottom",
    outer_diameter: 0.6,
  }) as RoutePoint

const pcbVia = (x: number, y: number, pcb_trace_id = "fanout"): PcbVia => ({
  type: "pcb_via",
  pcb_via_id: "via",
  pcb_trace_id,
  x,
  y,
  hole_diameter: 0.3,
  outer_diameter: 0.6,
  layers: ["top", "bottom"],
})

const pad = (id: string, x: number, y: number): PcbSmtPad => ({
  type: "pcb_smtpad",
  pcb_smtpad_id: id,
  pcb_port_id: `${id}_port`,
  shape: "rect",
  x,
  y,
  width: 0.5,
  height: 0.5,
  layer: "top",
})

const trace = (pcb_trace_id: string, route: RoutePoint[]): PcbTrace => ({
  type: "pcb_trace",
  pcb_trace_id,
  source_trace_id: "source_trace",
  route,
})

// Pad at the origin, fanout to a via at (2, 0), and nothing beyond it by default.
function fanoutToVia(extra: AnyCircuitElement[] = []): AnyCircuitElement[] {
  return [
    {
      type: "pcb_board",
      pcb_board_id: "board",
      center: { x: 0, y: 0 },
      width: 20,
      height: 20,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
    } as AnyCircuitElement,
    {
      type: "source_port",
      source_port_id: "pad_a_source_port",
      name: "pin1",
      source_component_id: "chip",
    } as AnyCircuitElement,
    {
      type: "pcb_port",
      pcb_port_id: "pad_a_port",
      source_port_id: "pad_a_source_port",
      x: 0,
      y: 0,
      layers: ["top"],
    } as AnyCircuitElement,
    {
      type: "source_trace",
      source_trace_id: "source_trace",
      connected_source_port_ids: ["pad_a_source_port"],
      connected_source_net_ids: ["net_a"],
    },
    pad("pad_a", 0, 0),
    trace("fanout", [wire(0, 0), wire(2, 0), viaPoint(2, 0)]),
    pcbVia(2, 0),
    ...extra,
  ]
}

const errorIds = (circuitJson: AnyCircuitElement[]) =>
  checkDanglingTraces(circuitJson).map((error) => error.pcb_trace_error_id)

const FANOUT_END = "disconnected_endpoint_fanout_end"

test("reports a pad fanout ending at a via with nothing beyond it", () => {
  const errors = checkDanglingTraces(fanoutToVia())
  expect(errors.map((error) => error.pcb_trace_error_id)).toEqual([FANOUT_END])
  expect(errors[0]).toMatchObject({ center: { x: 2, y: 0 } })
})

test("runAllRoutingChecks reports the same via endpoint", async () => {
  const errors = await runAllRoutingChecks(fanoutToVia())
  expect(
    errors.filter(
      (error) =>
        "pcb_trace_error_id" in error &&
        error.pcb_trace_error_id === FANOUT_END,
    ),
  ).toHaveLength(1)
})

test("reports a route that starts at a via with nothing beyond it", () => {
  const circuitJson = fanoutToVia()
  const fanout = circuitJson.find(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )!
  fanout.route = [viaPoint(2, 0), wire(2, 0), wire(0, 0)]
  expect(errorIds(circuitJson)).toEqual(["disconnected_endpoint_fanout_start"])
})

test("reports a via endpoint separated only by a zero-length wire", () => {
  const circuitJson = fanoutToVia()
  const fanout = circuitJson.find(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )!
  fanout.route = [wire(0, 0), wire(2, 0), viaPoint(2, 0), wire(2, 0, "bottom")]
  expect(errorIds(circuitJson)).toEqual([FANOUT_END])
})

test("reports a closed loop stopped by the same via once", () => {
  const circuitJson = fanoutToVia()
  const fanout = circuitJson.find(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )!
  fanout.route = [
    viaPoint(2, 0),
    wire(2, 0),
    wire(3, 0),
    wire(3, 1),
    wire(2, 0),
    viaPoint(2, 0),
  ]
  expect(errorIds(circuitJson)).toEqual(["disconnected_endpoint_fanout_start"])
})

// It has no wire that can dangle, so it matches a standalone pcb_via.
test("does not report a route that is only a via", () => {
  const circuitJson = fanoutToVia()
  const fanout = circuitJson.find(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )!
  fanout.route = [viaPoint(2, 0)]
  expect(errorIds(circuitJson)).toEqual([])
})

test("accepts a via continued by another trace on another layer", () => {
  expect(
    errorIds(
      fanoutToVia([
        pad("pad_b", 5, 0),
        trace("onward", [wire(2, 0, "bottom"), wire(5, 0, "bottom")]),
        {
          type: "pcb_smtpad",
          pcb_smtpad_id: "pad_b_bottom",
          pcb_port_id: "pad_b_bottom_port",
          shape: "rect",
          x: 5,
          y: 0,
          width: 0.5,
          height: 0.5,
          layer: "bottom",
        },
      ]),
    ),
  ).toEqual([])
})

test("accepts a via continued by another trace on the same layer", () => {
  expect(
    errorIds(
      fanoutToVia([
        pad("pad_b", 5, 0),
        trace("onward", [wire(2, 0), wire(5, 0)]),
      ]),
    ),
  ).toEqual([])
})

test("accepts a via that lands in a same-net pour", () => {
  const pour: PcbCopperPour = {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "pour",
    source_net_id: "net_a",
    layer: "bottom",
    covered_with_solder_mask: true,
    shape: "rect",
    center: { x: 2, y: 0 },
    width: 3,
    height: 3,
    rotation: 0,
  }
  expect(errorIds(fanoutToVia([pour]))).toEqual([])
})

test("rejects a via in a pour on another net", () => {
  const pour: PcbCopperPour = {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "pour",
    source_net_id: "net_b",
    layer: "bottom",
    covered_with_solder_mask: true,
    shape: "rect",
    center: { x: 2, y: 0 },
    width: 3,
    height: 3,
    rotation: 0,
  }
  expect(errorIds(fanoutToVia([pour]))).toEqual([FANOUT_END])
})

test("accepts a via that lands on a same-net pad", () => {
  const circuitJson = fanoutToVia([
    {
      type: "source_port",
      source_port_id: "pad_b_source_port",
      name: "pin2",
      source_component_id: "chip",
    } as AnyCircuitElement,
    {
      type: "pcb_port",
      pcb_port_id: "pad_b_port",
      source_port_id: "pad_b_source_port",
      x: 2,
      y: 0,
      layers: ["bottom"],
    } as AnyCircuitElement,
    { ...pad("pad_b", 2, 0), layer: "bottom" },
  ])
  const sourceTrace = circuitJson.find(
    (element) => element.type === "source_trace",
  )!
  if (sourceTrace.type === "source_trace") {
    sourceTrace.connected_source_port_ids.push("pad_b_source_port")
  }
  expect(errorIds(circuitJson)).toEqual([])
})

test("a trace's own wire beyond the via is not onward copper", () => {
  const circuitJson = fanoutToVia()
  const fanout = circuitJson.find(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )!
  fanout.route = [viaPoint(2, 0), wire(2, 0, "bottom"), wire(4, 0, "bottom")]
  const ids = errorIds(circuitJson)
  expect(ids).toContain("disconnected_endpoint_fanout_start")
  expect(ids).toContain("disconnected_endpoint_fanout_end")
})

test("keeps skipping marked antenna traces", () => {
  const circuitJson = fanoutToVia()
  const fanout = circuitJson.find(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )!
  fanout.is_antenna_trace = true
  expect(errorIds(circuitJson)).toEqual([])
})
