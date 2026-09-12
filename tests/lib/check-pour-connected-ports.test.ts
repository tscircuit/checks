import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbCopperPour, Ring } from "circuit-json"
import { checkEachPcbPortConnectedToPcbTraces as check } from "lib/check-each-pcb-port-connected-to-pcb-trace"

const rectangle = (x1: number, y1: number, x2: number, y2: number): Ring => ({
  vertices: [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ],
})
const pour = (
  overrides: Partial<Extract<PcbCopperPour, { shape: "brep" }>> = {},
): PcbCopperPour => ({
  type: "pcb_copper_pour",
  pcb_copper_pour_id: "pour",
  source_net_id: "gnd",
  layer: "bottom",
  shape: "brep",
  covered_with_solder_mask: true,
  brep_shape: { outer_ring: rectangle(-4, -3, 4, 3), inner_rings: [] },
  ...overrides,
})

function fixture(): AnyCircuitElement[] {
  const circuit: AnyCircuitElement[] = [
    {
      type: "source_net",
      source_net_id: "gnd",
      name: "GND",
      member_source_group_ids: [],
    },
  ]
  for (const [i, x] of [-2, 2].entries()) {
    circuit.push(
      {
        type: "source_component",
        source_component_id: `sc${i}`,
        name: `J${i + 1}`,
        ftype: "simple_chip",
        supplier_part_numbers: {},
      },
      {
        type: "source_port",
        source_port_id: `sp${i}`,
        source_component_id: `sc${i}`,
        name: "GND",
        pin_number: 1,
      },
      {
        type: "source_trace",
        source_trace_id: `st${i}`,
        connected_source_port_ids: [`sp${i}`],
        connected_source_net_ids: ["gnd"],
      },
      {
        type: "pcb_component",
        pcb_component_id: `pc${i}`,
        source_component_id: `sc${i}`,
        center: { x, y: 0 },
        width: 1.4,
        height: 1.4,
        rotation: 0,
        obstructs_within_bounds: false,
        layer: "top",
      },
      {
        type: "pcb_port",
        pcb_port_id: `pp${i}`,
        source_port_id: `sp${i}`,
        pcb_component_id: `pc${i}`,
        x,
        y: 0,
        layers: ["top", "bottom"],
      },
      {
        type: "pcb_plated_hole",
        pcb_plated_hole_id: `ph${i}`,
        pcb_port_id: `pp${i}`,
        pcb_component_id: `pc${i}`,
        x,
        y: 0,
        shape: "circle",
        outer_diameter: 1.4,
        hole_diameter: 0.8,
        layers: ["top", "bottom"],
      },
    )
  }
  circuit.push(pour())
  return circuit
}

const replacePour = (
  circuit: AnyCircuitElement[],
  ...pours: PcbCopperPour[]
) => [...circuit.filter((e) => e.type !== "pcb_copper_pour"), ...pours]

test("plated contacts joined by bottom BRep copper need no tracks (core #3901)", () => {
  expect(check(fixture())).toEqual([])
})

test("an unfilled board still reports both disconnected ports", () => {
  expect(check(replacePour(fixture()))).toHaveLength(2)
})

test("a pad outside the fill does not pass", () => {
  expect(
    check(
      replacePour(
        fixture(),
        pour({
          brep_shape: {
            outer_ring: rectangle(-4, -3, 0, 3),
            inner_rings: [],
          },
        }),
      ),
    ),
  ).toHaveLength(2)
})

test("an antipad around a plated contact breaks connectivity", () => {
  expect(
    check(
      replacePour(
        fixture(),
        pour({
          brep_shape: {
            outer_ring: rectangle(-4, -3, 4, 3),
            inner_rings: [rectangle(1, -1, 3, 1)],
          },
        }),
      ),
    ),
  ).toHaveLength(2)
})

test("a curved antipad excludes the whole annulus", () => {
  expect(
    check(
      replacePour(
        fixture(),
        pour({
          brep_shape: {
            outer_ring: rectangle(-4, -3, 4, 3),
            inner_rings: [
              {
                vertices: [
                  { x: 1, y: 0, bulge: 1 },
                  { x: 3, y: 0, bulge: 1 },
                ],
              },
            ],
          },
        }),
      ),
    ),
  ).toHaveLength(2)
})

test("drill voids in the pour still leave connected plated annuli", () => {
  const holes: Ring[] = [-2, 2].map((x) => ({
    vertices: [
      { x: x - 0.4, y: 0, bulge: 1 },
      { x: x + 0.4, y: 0, bulge: 1 },
    ],
  }))
  expect(
    check(
      replacePour(
        fixture(),
        pour({
          brep_shape: {
            outer_ring: rectangle(-4, -3, 4, 3),
            inner_rings: holes,
          },
        }),
      ),
    ),
  ).toEqual([])
})

test("matching net names cannot connect isolated pour islands", () => {
  expect(
    check(
      replacePour(
        fixture(),
        pour({
          brep_shape: { outer_ring: rectangle(-4, -3, -1, 3), inner_rings: [] },
        }),
        pour({
          pcb_copper_pour_id: "island",
          brep_shape: { outer_ring: rectangle(1, -3, 4, 3), inner_rings: [] },
        }),
      ),
    ),
  ).toHaveLength(2)
})

test("wrong-net and unassigned pours cannot satisfy a connection", () => {
  for (const source_net_id of ["other", undefined]) {
    expect(check(replacePour(fixture(), pour({ source_net_id })))).toHaveLength(
      2,
    )
  }
})

function smtFixture(): AnyCircuitElement[] {
  return fixture().map((e): AnyCircuitElement => {
    if (e.type === "pcb_port") return { ...e, layers: ["top"] }
    if (e.type !== "pcb_plated_hole") return e
    return {
      type: "pcb_smtpad",
      pcb_smtpad_id: e.pcb_plated_hole_id,
      pcb_component_id: e.pcb_component_id!,
      pcb_port_id: e.pcb_port_id,
      x: e.x,
      y: e.y,
      shape: "rect",
      width: 1.4,
      height: 1.4,
      layer: "top",
    }
  })
}

test("bottom copper does not connect top SMT pads", () => {
  expect(check(smtFixture())).toHaveLength(2)
})

test("same-layer SMT pads connect through a pour", () => {
  expect(check(replacePour(smtFixture(), pour({ layer: "top" })))).toEqual([])
})

test("a plated via joins top and bottom pours; layer overlap alone does not", () => {
  const circuit = smtFixture().map((e): AnyCircuitElement => {
    if (e.type === "pcb_smtpad" && e.pcb_port_id === "pp1")
      return { ...e, layer: "bottom" }
    if (e.type === "pcb_port" && e.pcb_port_id === "pp1")
      return { ...e, layers: ["bottom"] }
    return e
  })
  circuit.push(pour({ pcb_copper_pour_id: "top", layer: "top" }))
  expect(check(circuit)).toHaveLength(2)
  circuit.push({
    type: "pcb_via",
    pcb_via_id: "via",
    x: 0,
    y: 0,
    hole_diameter: 0.3,
    outer_diameter: 0.6,
    layers: ["top", "bottom"],
    source_net_id: "gnd",
  })
  expect(check(circuit)).toEqual([])
})

test("explicit port-to-port source traces also accept poured connections", () => {
  const circuit: AnyCircuitElement[] = fixture().filter(
    (e) => e.type !== "source_trace",
  )
  circuit.push({
    type: "source_trace",
    source_trace_id: "direct",
    connected_source_port_ids: ["sp0", "sp1"],
    connected_source_net_ids: ["gnd"],
  })
  expect(check(circuit)).toEqual([])
  expect(check(replacePour(circuit))).toHaveLength(1)
})

test("rectangular and polygon pours are supported", () => {
  const common = {
    type: "pcb_copper_pour" as const,
    pcb_copper_pour_id: "pour",
    source_net_id: "gnd",
    covered_with_solder_mask: true,
    layer: "bottom" as const,
  }
  expect(
    check(
      replacePour(fixture(), {
        ...common,
        shape: "rect",
        center: { x: 0, y: 0 },
        width: 8,
        height: 6,
        rotation: 0,
      }),
    ),
  ).toEqual([])
  expect(
    check(
      replacePour(fixture(), {
        ...common,
        shape: "polygon",
        points: rectangle(-4, -3, 4, 3).vertices,
      }),
    ),
  ).toEqual([])
})

test("contact at the annulus edge counts even when the pad center is outside", () => {
  expect(
    check(
      replacePour(
        fixture(),
        pour({
          brep_shape: {
            outer_ring: rectangle(-4, 0.5, 4, 2),
            inner_rings: [],
          },
        }),
      ),
    ),
  ).toEqual([])
})

test("copper wholly inside a drill hole cannot contact its annulus", () => {
  expect(
    check(
      replacePour(
        fixture(),
        pour({
          brep_shape: {
            outer_ring: rectangle(-2.1, -0.1, -1.9, 0.1),
            inner_rings: [],
          },
        }),
        pour({
          pcb_copper_pour_id: "island",
          brep_shape: {
            outer_ring: rectangle(1.9, -0.1, 2.1, 0.1),
            inner_rings: [],
          },
        }),
      ),
    ),
  ).toHaveLength(2)
})

test("pour islands can join through real trace copper away from the pads", () => {
  const circuit: AnyCircuitElement[] = replacePour(
    fixture(),
    pour({
      brep_shape: { outer_ring: rectangle(-4, -3, -1, 3), inner_rings: [] },
    }),
    pour({
      pcb_copper_pour_id: "island",
      brep_shape: { outer_ring: rectangle(1, -3, 4, 3), inner_rings: [] },
    }),
  )
  circuit.push({
    type: "pcb_trace",
    pcb_trace_id: "bridge",
    source_trace_id: "st0",
    route: [
      { route_type: "wire", x: -2, y: 2, width: 0.2, layer: "bottom" },
      { route_type: "wire", x: 2, y: 2, width: 0.2, layer: "bottom" },
    ],
  })
  expect(check(circuit)).toEqual([])
  const wrongLayer = circuit.map(
    (e): AnyCircuitElement =>
      e.type === "pcb_trace"
        ? {
            ...e,
            route: e.route.map((p) =>
              p.route_type === "wire" ? { ...p, layer: "top" } : p,
            ),
          }
        : e,
  )
  expect(check(wrongLayer)).toHaveLength(2)
})
