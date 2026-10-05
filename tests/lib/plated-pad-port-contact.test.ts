import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement, LayerRef } from "circuit-json"
import { checkEachPcbPortConnectedToPcbTraces } from "lib/check-each-pcb-port-connected-to-pcb-trace"
import { createIndexedPcbConnectivityMap } from "lib/util/create-indexed-pcb-connectivity-map"

function fixture(
  end = { x: 0, y: 0.019627030476826 },
  layer: LayerRef = "top",
): AnyCircuitElement[] {
  return [
    {
      type: "source_component",
      source_component_id: "sc_cap",
      name: "C_USB_BULK",
      ftype: "simple_capacitor",
      capacitance: 0.0001,
    },
    {
      type: "source_port",
      source_port_id: "sp_cap",
      source_component_id: "sc_cap",
      name: "pin1",
      pin_number: 1,
    },
    {
      type: "source_net",
      source_net_id: "sn_vbus",
      name: "USB_VBUS",
      member_source_group_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "st_cap",
      connected_source_port_ids: ["sp_cap"],
      connected_source_net_ids: ["sn_vbus"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pp_cap",
      source_port_id: "sp_cap",
      pcb_component_id: "pc_cap",
      x: 0,
      y: 0,
      layers: ["top", "inner1", "inner2", "bottom"],
    },
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "ph_cap",
      pcb_port_id: "pp_cap",
      x: 0,
      y: 0,
      shape: "circle",
      outer_diameter: 1.6,
      hole_diameter: 1,
      layers: ["top", "inner1", "inner2", "bottom"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pt_feed",
      source_trace_id: "st_cap",
      route: [
        { route_type: "wire", x: 2, y: end.y, width: 0.15, layer },
        { route_type: "wire", ...end, width: 0.15, layer },
      ],
    },
  ]
}

test("a trace ending off-center inside a plated pad reaches its port", () => {
  expect(checkEachPcbPortConnectedToPcbTraces(fixture())).toEqual([])
})

test("trace edge contact with a plated annulus reaches its port", () => {
  expect(
    checkEachPcbPortConnectedToPcbTraces(fixture({ x: 0.85, y: 0 })),
  ).toEqual([])
})

test("a gap outside the plated copper remains disconnected", () => {
  const errors = checkEachPcbPortConnectedToPcbTraces(fixture({ x: 0.9, y: 0 }))
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("C_USB_BULK.pin1")
  expect(errors[0].message).not.toContain("pp_cap")
})

test("copper entirely inside the drilled void does not contact the pad", () => {
  const circuit = fixture({ x: 0.1, y: 0.1 })
  const trace = circuit.find((e) => e.type === "pcb_trace")!
  if (trace.route[0].route_type !== "wire") throw Error("Expected wire")
  trace.route[0].x = 0.2
  expect(checkEachPcbPortConnectedToPcbTraces(circuit)).toHaveLength(1)
})

test("a plated barrel joins traces contacting different declared layers", () => {
  const circuit = fixture({ x: 0.7, y: 0 }, "inner1")
  circuit.push({
    type: "pcb_trace",
    pcb_trace_id: "pt_bottom",
    route: [
      { route_type: "wire", x: -2, y: 0, width: 0.15, layer: "bottom" },
      { route_type: "wire", x: -0.7, y: 0, width: 0.15, layer: "bottom" },
    ],
  })
  const map = createIndexedPcbConnectivityMap(circuit)
  expect(
    map
      .getAllTracesConnectedToPort("pp_cap")
      .map((t) => t.pcb_trace_id)
      .sort(),
  ).toEqual(["pt_bottom", "pt_feed"])
})

test("a layer outside the plated span remains disconnected", () => {
  const circuit = fixture({ x: 0.7, y: 0 }, "inner1")
  const pad = circuit.find((e) => e.type === "pcb_plated_hole")!
  pad.layers = ["top", "bottom"]
  expect(checkEachPcbPortConnectedToPcbTraces(circuit)).toHaveLength(1)
})

test("unnamed plated ports still report an honest disconnected-port error", () => {
  const circuit = fixture({ x: 0.9, y: 0 }).filter(
    (e) => e.type !== "source_component" && e.type !== "source_port",
  )
  const errors = checkEachPcbPortConnectedToPcbTraces(circuit)
  expect(errors).toHaveLength(1)
  expect(errors[0].message).not.toMatch(/pp_cap|pc_cap|sp_cap/)
})

test("offset plated-pad contact snapshot", async () => {
  const circuit = fixture()
  expect(checkEachPcbPortConnectedToPcbTraces(circuit)).toEqual([])
  await expect(convertCircuitJsonToPcbSvg(circuit)).toMatchSvgSnapshot(
    import.meta.path,
  )
})

test("rotated rectangular plated pads use their copper outline", () => {
  const circuit = fixture({ x: 0.65, y: 0 })
  const index = circuit.findIndex((e) => e.type === "pcb_plated_hole")
  circuit[index] = {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "ph_cap",
    pcb_port_id: "pp_cap",
    shape: "circular_hole_with_rect_pad",
    hole_shape: "circle",
    pad_shape: "rect",
    x: 0,
    y: 0,
    rect_pad_width: 1.6,
    rect_pad_height: 1.2,
    rect_ccw_rotation: 90,
    hole_diameter: 0.6,
    hole_offset_x: 0,
    hole_offset_y: 0,
    layers: ["top", "bottom"],
  }
  expect(checkEachPcbPortConnectedToPcbTraces(circuit)).toEqual([])
  const trace = circuit.find((e) => e.type === "pcb_trace")!
  const end = trace.route.at(-1)!
  if (end.route_type !== "wire") throw Error("Expected wire")
  end.x = 0.7
  expect(checkEachPcbPortConnectedToPcbTraces(circuit)).toHaveLength(1)
})
