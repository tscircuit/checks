import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { checkDanglingTraces } from "lib/check-dangling-traces/check-dangling-traces"

type WirePoint = Extract<PcbTrace["route"][number], { route_type: "wire" }>

const wire = (x: number, y: number, width = 0.2): WirePoint => ({
  route_type: "wire",
  x,
  y,
  layer: "top",
  width,
})

// Target pad spans x from -0.25 to 0.25. The anchor pad holds the trace's other end.
function endpointNearPad(
  endX: number,
  {
    padNet = "net_a",
    padLayer = "top",
  }: { padNet?: string; padLayer?: "top" | "bottom" } = {},
): AnyCircuitElement[] {
  return [
    {
      type: "source_port",
      source_port_id: "anchor_source",
      name: "pin1",
      source_component_id: "chip",
    },
    {
      type: "pcb_port",
      pcb_port_id: "anchor_port",
      source_port_id: "anchor_source",
      x: -3,
      y: 0,
      layers: ["top"],
    },
    {
      type: "source_port",
      source_port_id: "target_source",
      name: "pin2",
      source_component_id: "chip",
    },
    {
      type: "pcb_port",
      pcb_port_id: "target_port",
      source_port_id: "target_source",
      x: 0,
      y: 0,
      layers: [padLayer],
    },
    {
      type: "source_trace",
      source_trace_id: "source_target",
      connected_source_port_ids: ["anchor_source"],
      connected_source_net_ids: ["net_a"],
    },
    {
      type: "source_trace",
      source_trace_id: "source_pad",
      connected_source_port_ids: ["target_source"],
      connected_source_net_ids: [padNet],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "anchor_pad",
      pcb_port_id: "anchor_port",
      shape: "rect",
      x: -3,
      y: 0,
      width: 0.5,
      height: 0.5,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "target_pad",
      pcb_port_id: "target_port",
      shape: "rect",
      x: 0,
      y: 0,
      width: 0.5,
      height: 0.5,
      layer: padLayer,
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "target",
      source_trace_id: "source_target",
      route: [wire(-3, 0), wire(endX, 0)],
    },
  ] as AnyCircuitElement[]
}

const END_ERROR = "disconnected_endpoint_target_end"

const errorIds = (circuitJson: AnyCircuitElement[]) =>
  checkDanglingTraces(circuitJson).map((error) => error.pcb_trace_error_id)

test("accepts an end whose center rounds just outside a same-net pad", () => {
  expect(errorIds(endpointNearPad(-0.2500002))).toEqual([])
})

test("accepts an end whose round copper cap overlaps a same-net pad", () => {
  expect(errorIds(endpointNearPad(-0.3))).toEqual([])
})

test("reports an end whose copper stops short of a same-net pad", () => {
  expect(errorIds(endpointNearPad(-0.36))).toEqual([END_ERROR])
})

test("does not treat a tangent copper cap as contact", () => {
  expect(errorIds(endpointNearPad(-0.35))).toEqual([END_ERROR])
})

test("reports an end whose copper cap only overlaps a pad on another net", () => {
  expect(errorIds(endpointNearPad(-0.3, { padNet: "net_b" }))).toEqual([
    END_ERROR,
  ])
})

test("reports an end whose copper cap overlaps a pad on another layer", () => {
  expect(errorIds(endpointNearPad(-0.3, { padLayer: "bottom" }))).toEqual([
    END_ERROR,
  ])
})

test("reports a stub leaving a pad even when its tip overlaps that pad", () => {
  const circuitJson = endpointNearPad(-0.3)
  const target = circuitJson.find(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )!
  // Both route points are on net_a; the tip lies 0.05 mm past the pad edge.
  target.route = [wire(0, 0), wire(-0.3, 0)]
  expect(errorIds(circuitJson)).toEqual([END_ERROR])
})

test("uses the incoming segment's width for the copper cap", () => {
  const circuitJson = endpointNearPad(-0.3)
  const target = circuitJson.find(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )!
  // A wide final route point does not widen the thin segment that reaches it.
  target.route = [wire(-3, 0, 0.05), wire(-0.3, 0, 1)]
  expect(errorIds(circuitJson)).toEqual([END_ERROR])
})
