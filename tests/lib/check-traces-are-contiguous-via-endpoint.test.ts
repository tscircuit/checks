import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"

const circuit: AnyCircuitElement[] = [
  {
    type: "pcb_board",
    pcb_board_id: "board",
    center: { x: 0, y: 0 },
    width: 10,
    height: 6,
    thickness: 1.6,
    material: "fr4",
    num_layers: 4,
  },
  {
    type: "source_net",
    source_net_id: "shared_net",
    name: "DATA",
    member_source_group_ids: [],
  },
  {
    type: "source_trace",
    source_trace_id: "escape_source",
    connected_source_port_ids: ["pad_source"],
    connected_source_net_ids: ["shared_net"],
  },
  {
    type: "source_trace",
    source_trace_id: "destination_source",
    connected_source_port_ids: ["destination"],
    connected_source_net_ids: ["shared_net"],
  },
  {
    type: "pcb_port",
    pcb_port_id: "pad_port",
    source_port_id: "pad_source",
    x: -1,
    y: 0,
    layers: ["top"],
  },
  {
    type: "pcb_port",
    pcb_port_id: "destination_port",
    source_port_id: "destination",
    x: 2,
    y: 0,
    layers: ["inner2"],
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad",
    pcb_port_id: "pad_port",
    shape: "rect",
    x: -1,
    y: 0,
    width: 0.4,
    height: 0.4,
    layer: "top",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "destination_pad",
    pcb_port_id: "destination_port",
    shape: "rect",
    x: 2,
    y: 0,
    width: 0.4,
    height: 0.4,
    layer: "inner2",
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "local_escape",
    source_trace_id: "escape_source",
    route: [
      { route_type: "wire", x: -1, y: 0, layer: "top", width: 0.1 },
      { route_type: "wire", x: 0, y: 0, layer: "top", width: 0.1 },
      { route_type: "via", x: 0, y: 0, from_layer: "top", to_layer: "inner1" },
      { route_type: "wire", x: 0, y: 0, layer: "inner1", width: 0.1 },
    ],
  },
  {
    type: "pcb_via",
    pcb_via_id: "owned_barrel",
    pcb_trace_id: "local_escape",
    x: 0,
    y: 0,
    hole_diameter: 0.15,
    outer_diameter: 0.35,
    layers: ["top", "inner1", "inner2", "bottom"],
  },
]

function carrier(
  reverse: boolean,
  x = 0,
  layer: "inner1" | "bottom" = "inner1",
): PcbTrace {
  const route: PcbTrace["route"] = [
    { route_type: "wire", x, y: 0, layer, width: 0.1 },
    { route_type: "via", x, y: 0, from_layer: layer, to_layer: "inner2" },
    { route_type: "wire", x, y: 0, layer: "inner2", width: 0.1 },
    { route_type: "wire", x: 2, y: 0, layer: "inner2", width: 0.1 },
  ]
  return {
    type: "pcb_trace",
    pcb_trace_id: "carrier",
    source_trace_id: "shared_net",
    route: reverse
      ? route.toReversed().map((point) =>
          point.route_type === "via"
            ? {
                ...point,
                from_layer: point.to_layer,
                to_layer: point.from_layer,
              }
            : point,
        )
      : route,
  }
}

test("net-owned routes recognize a coincident endpoint via without accepting gaps, foreign nets or missing layers", () => {
  for (const reverse of [false, true]) {
    expect(checkTracesAreContiguous([...circuit, carrier(reverse)])).toEqual([])
    expect(
      checkTracesAreContiguous([...circuit, carrier(reverse, 0.6)]).some(
        (error) => error.pcb_trace_id === "carrier",
      ),
    ).toBe(true)
    const foreign = circuit.map((element) =>
      element.type === "source_trace" &&
      element.source_trace_id === "escape_source"
        ? { ...element, connected_source_net_ids: ["foreign_net"] }
        : element,
    )
    expect(
      checkTracesAreContiguous([...foreign, carrier(reverse)]).some(
        (error) => error.pcb_trace_id === "carrier",
      ),
    ).toBe(true)
    const buried = circuit.map<AnyCircuitElement>((element) =>
      element.type === "pcb_via"
        ? { ...element, layers: ["top", "inner1"] }
        : element,
    )
    expect(
      checkTracesAreContiguous([...buried, carrier(reverse, 0, "bottom")]).some(
        (error) => error.pcb_trace_id === "carrier",
      ),
    ).toBe(true)
    const wideEndpoint = carrier(reverse)
    wideEndpoint.source_trace_id = "carrier_source"
    wideEndpoint.route = wideEndpoint.route.map((point) =>
      point.route_type === "wire" && point.layer === "inner1"
        ? { ...point, width: 1 }
        : point,
    )
    const requiredPad: AnyCircuitElement[] = [
      {
        type: "source_trace",
        source_trace_id: "carrier_source",
        connected_source_port_ids: ["nearby_source", "destination"],
        connected_source_net_ids: ["shared_net"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "nearby_port",
        source_port_id: "nearby_source",
        x: 0.4,
        y: 0,
        layers: ["inner1"],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "nearby_pad",
        pcb_port_id: "nearby_port",
        shape: "rect",
        x: 0.4,
        y: 0,
        width: 0.1,
        height: 0.1,
        layer: "inner1",
      },
    ]
    // A zero-length wire at the barrel does not create a disk of wire.width.
    expect(
      checkTracesAreContiguous([...circuit, ...requiredPad, wideEndpoint]).some(
        (error) =>
          error.pcb_trace_id === "carrier" &&
          error.pcb_port_ids?.includes("nearby_port"),
      ),
    ).toBe(true)
    const centeredPad = requiredPad.map((element) =>
      element.type === "pcb_port" || element.type === "pcb_smtpad"
        ? { ...element, x: 0 }
        : element,
    )
    expect(
      checkTracesAreContiguous([...circuit, ...centeredPad, wideEndpoint]),
    ).toEqual([])
  }
})
