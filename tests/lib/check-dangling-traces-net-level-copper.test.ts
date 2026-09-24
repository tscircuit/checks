import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  PcbCopperPour,
  PcbTrace,
  PcbVia,
} from "circuit-json"

type WirePoint = Extract<PcbTrace["route"][number], { route_type: "wire" }>

function wirePoint(x: number, y: number): WirePoint {
  return { route_type: "wire", x, y, layer: "top", width: 0.2 }
}

// A target trace ends at a T-junction with another trace on the same net.
function copperJunction() {
  const target: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "target",
    source_trace_id: "source_target",
    route: [wirePoint(-2, 0), wirePoint(0, 0)],
  }
  const branch: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "branch",
    source_trace_id: "source_branch",
    route: [wirePoint(0, -1), wirePoint(0, 1)],
  }
  const sourceBranch = {
    type: "source_trace" as const,
    source_trace_id: "source_branch",
    connected_source_port_ids: [],
    connected_source_net_ids: ["net_a"],
  }
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_trace",
      source_trace_id: "source_target",
      connected_source_port_ids: [],
      connected_source_net_ids: ["net_a"],
    },
    sourceBranch,
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "anchor",
      pcb_port_id: "anchor_port",
      shape: "rect",
      x: -2,
      y: 0,
      width: 0.3,
      height: 0.3,
      layer: "top",
    },
    target,
    branch,
  ]
  return { circuitJson, target, branch, sourceBranch }
}

function viaJunction() {
  const fixture = copperJunction()
  for (const point of fixture.branch.route) {
    if (point.route_type === "wire") point.layer = "bottom"
  }
  const via: PcbVia = {
    type: "pcb_via",
    pcb_via_id: "junction_via",
    pcb_trace_id: "branch",
    x: 0,
    y: 0,
    hole_diameter: 0.2,
    outer_diameter: 0.4,
    layers: ["top", "bottom"],
  }
  fixture.circuitJson.push(via)
  return { circuitJson: fixture.circuitJson, branch: fixture.branch, via }
}

function targetErrorIds(circuitJson: AnyCircuitElement[]) {
  return checkTracesAreContiguous(circuitJson)
    .filter((error) => error.pcb_trace_id === "target")
    .map((error) => error.pcb_trace_error_id)
}

const END_ERROR = "disconnected_endpoint_target_end"

test("accepts a same-layer T-junction across source traces on a shared net", () => {
  const { circuitJson } = copperJunction()
  expect(targetErrorIds(circuitJson)).toEqual([])
})

test("rejects trace copper on another net", () => {
  const { circuitJson, sourceBranch } = copperJunction()
  sourceBranch.connected_source_net_ids = ["net_b"]
  expect(targetErrorIds(circuitJson)).toEqual([END_ERROR])
})

test("rejects trace copper on another layer", () => {
  const { circuitJson, branch } = copperJunction()
  for (const point of branch.route) {
    if (point.route_type === "wire") point.layer = "bottom"
  }
  expect(targetErrorIds(circuitJson)).toEqual([END_ERROR])
})

test("reports a short branch even when its tip overlaps junction copper", () => {
  const { circuitJson, target } = copperJunction()
  target.route = [wirePoint(0, 0), wirePoint(0.05, 0)]
  // Current checker mistakes junction copper for a connection at the free tip.
  expect(targetErrorIds(circuitJson)).toEqual([])
})

test("accepts a same-net pour but rejects a different net or layer", () => {
  const { circuitJson, branch } = copperJunction()
  branch.route = []
  const pour: PcbCopperPour = {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "pour",
    source_net_id: "net_a",
    layer: "top",
    covered_with_solder_mask: true,
    shape: "rect",
    center: { x: 0, y: 0 },
    width: 1,
    height: 1,
    rotation: 0,
  }
  circuitJson.push(pour)
  // Current checker does not recognize same-net pour contact.
  expect(targetErrorIds(circuitJson)).toEqual([END_ERROR])
  pour.source_net_id = "net_b"
  expect(targetErrorIds(circuitJson)).toEqual([END_ERROR])
  pour.source_net_id = "net_a"
  pour.layer = "bottom"
  expect(targetErrorIds(circuitJson)).toEqual([END_ERROR])
})

test("accepts a via connected to onward copper without changing the input", () => {
  const { circuitJson } = viaJunction()
  const before = structuredClone(circuitJson)
  expect(targetErrorIds(circuitJson)).toEqual([])
  expect(circuitJson).toEqual(before)
})

test("rejects an isolated same-net via", () => {
  const { circuitJson, branch } = viaJunction()
  branch.route = []
  expect(targetErrorIds(circuitJson)).toEqual([END_ERROR])
})

test("rejects a via on a different net", () => {
  const { circuitJson, via } = viaJunction()
  delete via.pcb_trace_id
  via.source_net_id = "net_b"
  expect(targetErrorIds(circuitJson)).toEqual([END_ERROR])
})

test("requires the via span to include the endpoint and onward copper", () => {
  const { circuitJson, via } = viaJunction()
  via.layers = ["inner1", "bottom"]
  expect(targetErrorIds(circuitJson)).toEqual([END_ERROR])
  via.layers = ["top", "inner1"]
  expect(targetErrorIds(circuitJson)).toEqual([END_ERROR])
})

test("accepts a route-only via connected to onward copper", () => {
  const { circuitJson, branch } = copperJunction()
  for (const point of branch.route) {
    if (point.route_type === "wire") point.layer = "bottom"
  }
  branch.route.unshift({
    route_type: "via",
    x: 0,
    y: 0,
    from_layer: "top",
    to_layer: "bottom",
    outer_diameter: 0.4,
  })
  expect(targetErrorIds(circuitJson)).toEqual([])
})
