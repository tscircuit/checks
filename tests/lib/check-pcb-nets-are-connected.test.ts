import { expect, test } from "bun:test"
import {
  any_circuit_element,
  type AnyCircuitElement,
  type PcbTrace,
} from "circuit-json"
import { checkPcbNetsAreConnected } from "lib/check-pcb-nets-are-connected"
import { runAllRoutingChecks } from "lib/run-all-checks"
import { containsCircuitJsonId } from "lib/util/get-readable-names"
import { disconnectedPcbNet } from "../fixtures/disconnected-pcb-net"

const fixture = () => structuredClone(disconnectedPcbNet)
const check = (circuit: AnyCircuitElement[]) =>
  checkPcbNetsAreConnected(circuit.map((e) => any_circuit_element.parse(e)))
const ports = [0, 1, 2, 3].map((i) => `pcb_port_${i}`)
const bridge = (y = 0): PcbTrace => ({
  type: "pcb_trace",
  pcb_trace_id: "pcb_trace_bridge",
  source_trace_id: "source_trace_1",
  route: [
    {
      route_type: "wire",
      x: 2,
      y,
      layer: "top",
      width: 0.2,
      start_pcb_port_id: "pcb_port_1",
    },
    {
      route_type: "wire",
      x: 10,
      y,
      layer: "top",
      width: 0.2,
      end_pcb_port_id: "pcb_port_2",
    },
  ],
})
const expectDisconnected = (circuit: AnyCircuitElement[]) => {
  const errors = check(circuit)
  expect(errors).toHaveLength(1)
  expect(errors[0]?.pcb_port_ids).toEqual(ports)
  expect(errors[0]?.message).toMatch(/disconnected/i)
  return errors
}

test("reports two physical islands despite shared logical metadata", () => {
  const circuit = fixture()
  const before = structuredClone(circuit)
  const [error] = expectDisconnected(circuit)
  expect(error?.message).toContain("V3V3")
  expect(circuit).toEqual(before)
})

test("a physical bridge connects the net regardless of route ownership", () => {
  const wire = bridge()
  delete wire.source_trace_id
  expect(check([...fixture(), wire])).toEqual([])
})

test("equal names and connectivity keys do not merge distinct scoped nets", () => {
  const circuit = fixture()
  circuit.push({
    type: "source_net",
    source_net_id: "source_net_2",
    name: "V3V3",
    member_source_group_ids: [],
    subcircuit_id: "subcircuit_2",
    subcircuit_connectivity_map_key: "isolated_two_pair_test",
  })
  for (const e of circuit) {
    if (e.type === "source_net" && e.source_net_id === "source_net_1")
      e.subcircuit_id = "subcircuit_1"
    if (
      e.type === "source_trace" &&
      ["source_trace_2", "source_trace_3"].includes(e.source_trace_id)
    ) {
      e.connected_source_net_ids = ["source_net_2"]
      e.subcircuit_id = "subcircuit_2"
    }
  }
  expect(check(circuit)).toEqual([])
})

test("direct multiport source traces require the same physical continuity", () => {
  const circuit: AnyCircuitElement[] = fixture().filter(
    (e) => e.type !== "source_trace",
  )
  circuit.push({
    type: "source_trace",
    source_trace_id: "source_trace_direct",
    connected_source_port_ids: [0, 1, 2, 3].map((i) => `source_port_${i}`),
    connected_source_net_ids: [],
  })
  for (const e of circuit)
    if (e.type === "pcb_trace") e.source_trace_id = "source_trace_direct"
  expectDisconnected(circuit)
  expect(check([...circuit, bridge()])).toEqual([])
})

test("an unattached required port remains an isolated physical component", () => {
  expectDisconnected(
    fixture().filter(
      (e) => !(e.type === "pcb_trace" && e.pcb_trace_id === "pcb_trace_2"),
    ),
  )
})

for (const intentional of [
  "unlisted",
  "do_not_connect",
  "single_port",
] as const) {
  test(`ignores intentional ${intentional} isolation`, () => {
    const circuit = fixture().filter(
      (e) =>
        !(
          e.type === "source_trace" &&
          (intentional === "single_port"
            ? e.source_trace_id !== "source_trace_0"
            : intentional === "unlisted" &&
              ["source_trace_2", "source_trace_3"].includes(e.source_trace_id))
        ),
    )
    if (intentional === "do_not_connect")
      for (const e of circuit) {
        if (
          e.type === "source_port" &&
          ["source_port_2", "source_port_3"].includes(e.source_port_id)
        )
          e.do_not_connect = true
      }
    expect(check(circuit)).toEqual([])
  })
}

for (const form of ["component", "record"] as const) {
  test(`${form} internal connections do not certify PCB copper`, () => {
    const circuit = fixture()
    for (const e of circuit) {
      if (e.type === "source_port" && e.source_port_id === "source_port_2")
        e.source_component_id = "source_component_1"
      if (
        e.type === "source_component" &&
        e.source_component_id === "source_component_1" &&
        form === "component"
      )
        e.internally_connected_source_port_ids = [
          ["source_port_1", "source_port_2"],
        ]
    }
    if (form === "record")
      circuit.push({
        type: "source_component_internal_connection",
        source_component_internal_connection_id: "internal_link",
        source_component_id: "source_component_1",
        source_port_ids: ["source_port_1", "source_port_2"],
      })
    expectDisconnected(circuit)
    // Separate external networks may rely on an internal conductive link;
    // it does not impose an additional exterior PCB bridge between them.
    const independent: AnyCircuitElement[] = circuit.filter(
      (e) => e.type !== "source_trace",
    )
    for (const i of [0, 2])
      independent.push({
        type: "source_trace",
        source_trace_id: `source_trace_${i}`,
        connected_source_port_ids: [`source_port_${i}`, `source_port_${i + 1}`],
        connected_source_net_ids: [],
      })
    expect(check(independent)).toEqual([])
  })
}

test("an internal-only unused peer does not become a required PCB connection", () => {
  const circuit = fixture().filter(
    (e) =>
      !(
        e.type === "source_trace" &&
        ["source_trace_2", "source_trace_3"].includes(e.source_trace_id)
      ),
  )
  for (const e of circuit)
    if (
      e.type === "source_component" &&
      e.source_component_id === "source_component_1"
    )
      e.internally_connected_source_port_ids = [
        ["source_port_1", "source_port_2"],
      ]
  expect(check(circuit)).toEqual([])
})

test("an excluded padless NC peer does not suppress required net continuity", () => {
  const circuit = fixture()
  circuit.push(
    {
      type: "source_port",
      source_port_id: "source_port_nc",
      source_component_id: "source_component_0",
      name: "NC",
      do_not_connect: true,
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_nc",
      connected_source_port_ids: ["source_port_nc"],
      connected_source_net_ids: ["source_net_1"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_nc",
      source_port_id: "source_port_nc",
      pcb_component_id: "pcb_component_0",
      x: 6,
      y: 2,
      layers: ["top"],
    },
  )
  expectDisconnected(circuit)
})

test("all emitted PCB ports of a required source pin participate", () => {
  const circuit = [...fixture(), bridge()]
  circuit.push(
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_extra",
      source_port_id: "source_port_0",
      pcb_component_id: "pcb_component_0",
      x: 6,
      y: 2,
      layers: ["top"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_extra",
      pcb_port_id: "pcb_port_extra",
      pcb_component_id: "pcb_component_0",
      x: 6,
      y: 2,
      shape: "rect",
      width: 1,
      height: 1,
      layer: "top",
    },
  )
  const errors = check(circuit)
  expect(errors).toHaveLength(1)
  expect(errors[0]?.pcb_port_ids).toEqual([...ports, "pcb_port_extra"])
})

const layered = () => {
  const circuit = [...fixture(), bridge()]
  for (const e of circuit) {
    if (
      e.type === "pcb_smtpad" &&
      ["pcb_smtpad_2", "pcb_smtpad_3"].includes(e.pcb_smtpad_id)
    )
      e.layer = "bottom"
    if (
      e.type === "pcb_port" &&
      ["pcb_port_2", "pcb_port_3"].includes(e.pcb_port_id)
    )
      e.layers = ["bottom"]
    if (e.type === "pcb_trace" && e.pcb_trace_id === "pcb_trace_2")
      for (const p of e.route) if (p.route_type === "wire") p.layer = "bottom"
  }
  return circuit
}

for (const layers of [["bottom"], ["top", "bottom"]] as const) {
  test(`via barrel with ${layers.join("/")} span ${layers.length === 2 ? "connects" : "cannot join"} the layer islands`, () => {
    const circuit = layered()
    circuit.push({
      type: "pcb_via",
      pcb_via_id: "via",
      x: 10,
      y: 0,
      layers: [...layers],
      outer_diameter: 0.6,
      hole_diameter: 0.3,
    })
    if (layers.length === 2) expect(check(circuit)).toEqual([])
    else expectDisconnected(circuit)
  })
}

test("overlapping copper on separate layers needs a barrel", () => {
  expectDisconnected(layered())
})

test("a plated pad joins its emitted layers", () => {
  const circuit = layered().filter(
    (e) => !(e.type === "pcb_smtpad" && e.pcb_smtpad_id === "pcb_smtpad_2"),
  )
  circuit.push({
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "plated_bridge",
    pcb_port_id: "pcb_port_2",
    pcb_component_id: "pcb_component_2",
    x: 10,
    y: 0,
    shape: "circle",
    layers: ["top", "bottom"],
    outer_diameter: 1,
    hole_diameter: 0.4,
  })
  expect(check(circuit)).toEqual([])
})

const poured = () => fixture().filter((e) => e.type !== "pcb_trace")
const pour = (id: string, x: number, width: number): AnyCircuitElement => ({
  type: "pcb_copper_pour",
  pcb_copper_pour_id: id,
  source_net_id: "source_net_1",
  shape: "rect",
  center: { x, y: 0 },
  width,
  height: 2,
  rotation: 0,
  layer: "top",
  covered_with_solder_mask: true,
})

test("one physical pour joins all pads without tracks", () => {
  expect(check([...poured(), pour("whole", 6, 14)])).toEqual([])
})

test("same-net pours remain separate islands until copper bridges them", () => {
  const circuit = [...poured(), pour("left", 1, 4), pour("right", 11, 4)]
  expectDisconnected(circuit)
  expect(check([...circuit, bridge()])).toEqual([])
})

test("a BRep antipad leaves the covered pad disconnected", () => {
  const circuit = poured()
  circuit.push({
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "cutout",
    source_net_id: "source_net_1",
    shape: "brep",
    layer: "top",
    covered_with_solder_mask: true,
    brep_shape: {
      outer_ring: {
        vertices: [
          { x: -1, y: -2 },
          { x: 13, y: -2 },
          { x: 13, y: 2 },
          { x: -1, y: 2 },
        ],
      },
      inner_rings: [
        {
          vertices: [
            { x: 9, y: -1 },
            { x: 9, y: 1 },
            { x: 11, y: 1 },
            { x: 11, y: -1 },
          ],
        },
      ],
    },
  })
  expectDisconnected(circuit)
})

test("remote endpoint IDs cannot replace an actual copper bridge", () => {
  expectDisconnected([...fixture(), bridge(3)])
})

test("via route ownership cannot bridge a remote trace", () => {
  const circuit = fixture()
  circuit.push({
    type: "pcb_via",
    pcb_via_id: "remote_owned_via",
    pcb_trace_id: "pcb_trace_2",
    x: 2,
    y: 0,
    layers: ["top", "bottom"],
    outer_diameter: 0.6,
    hole_diameter: 0.3,
  })
  expectDisconnected(circuit)
})

test("remote via port annotations cannot join actual pad islands", () => {
  const circuit = fixture()
  circuit.push({
    type: "pcb_via",
    pcb_via_id: "remote_via_ports",
    pcb_port_ids: ports,
    x: 6,
    y: 2,
    layers: ["top", "bottom"],
    outer_diameter: 0.6,
    hole_diameter: 0.3,
  })
  expectDisconnected(circuit)
})

for (const alias of ["matching", "remote", "wrong_layer"] as const) {
  test(`manual via layer-port alias ${alias} must match physical barrel`, () => {
    const circuit = [...fixture(), bridge()]
    circuit.push(
      {
        type: "source_manually_placed_via",
        source_manually_placed_via_id: "source_manual_via",
        source_group_id: "source_group",
        source_net_id: "source_net_1",
      },
      {
        type: "source_port",
        source_port_id: "source_port_alias",
        source_component_id: "source_manual_via",
        name: "bottom",
      },
      {
        type: "source_trace",
        source_trace_id: "source_trace_alias",
        connected_source_port_ids: ["source_port_alias"],
        connected_source_net_ids: ["source_net_1"],
      },
      {
        type: "pcb_port",
        pcb_port_id: "pcb_port_alias",
        source_port_id: "source_port_alias",
        x: alias === "remote" ? 6 : 10,
        y: alias === "remote" ? 2 : 0,
        layers: ["bottom"],
      },
      {
        type: "pcb_via",
        pcb_via_id: "manual_via",
        pcb_port_ids: ["pcb_port_alias"],
        x: 10,
        y: 0,
        layers: alias === "wrong_layer" ? ["top"] : ["top", "bottom"],
        outer_diameter: 0.6,
        hole_diameter: 0.3,
      },
    )
    const errors = check(circuit)
    if (alias === "matching") expect(errors).toEqual([])
    else {
      expect(errors).toHaveLength(1)
      expect(errors[0]?.pcb_port_ids).toEqual([...ports, "pcb_port_alias"])
    }
  })
}

test("a near-degenerate wire at a copper contact cannot crash aggregate routing", async () => {
  const tiny = bridge()
  tiny.pcb_trace_id = "pcb_trace_tiny"
  tiny.route = [
    {
      route_type: "wire",
      x: 2,
      y: 0,
      layer: "top",
      width: 0.2,
      start_pcb_port_id: "pcb_port_1",
    },
    {
      route_type: "wire",
      x: 2 + 2.84e-14,
      y: 0,
      layer: "top",
      width: 0.2,
      end_pcb_port_id: "pcb_port_1",
    },
  ]
  const circuit = [...fixture(), bridge(), tiny].map((e) =>
    any_circuit_element.parse(e),
  )
  expect(await runAllRoutingChecks(circuit)).toEqual([])
})

for (const special of ["interpolated", "through_pad"] as const) {
  test(`defers attributed unsupported ${special} geometry conservatively`, () => {
    const circuit = fixture()
    const trace = circuit.find((e) => e.type === "pcb_trace")
    if (trace?.type !== "pcb_trace") throw new Error("Fixture trace missing")
    if (special === "interpolated") trace.route_thickness_mode = "interpolated"
    else
      trace.route = [
        {
          route_type: "through_pad",
          start: { x: 0, y: 0 },
          end: { x: 2, y: 0 },
          start_layer: "top",
          end_layer: "top",
          width: 0.2,
        },
      ]
    expect(check(circuit)).toEqual([])
  })
}

test("unrelated unsupported geometry does not suppress a disconnected net", () => {
  const unrelated = bridge(3)
  unrelated.route_thickness_mode = "interpolated"
  delete unrelated.source_trace_id
  for (const p of unrelated.route)
    if (p.route_type === "wire") {
      delete p.start_pcb_port_id
      delete p.end_pcb_port_id
    }
  expectDisconnected([...fixture(), unrelated])
})

test("unnamed diagnostics use honest readable labels", () => {
  const circuit = fixture()
  for (const e of circuit)
    if (
      e.type === "source_net" ||
      e.type === "source_component" ||
      e.type === "source_port"
    )
      e.name = ""
  const [error] = expectDisconnected(circuit)
  expect(containsCircuitJsonId(error!.message)).toBe(false)
})
