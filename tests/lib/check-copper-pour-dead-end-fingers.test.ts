import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkCopperPourDeadEndFingers, runAllRoutingChecks } from "../../index"

const net = { type: "source_net", source_net_id: "source_net_1", name: "GND" }
const points = (coordinates: number[][]) =>
  coordinates.map(([x, y]) => ({ x, y }))
const outline = (length = 5, width = 1) =>
  points([
    [0, 0],
    [5, 0],
    [5, 2],
    [5 + length, 2],
    [5 + length, 2 + width],
    [5, 2 + width],
    [5, 6],
    [0, 6],
  ])
const pour = (vertices = outline()) => ({
  type: "pcb_copper_pour",
  pcb_copper_pour_id: "pcb_copper_pour_1",
  shape: "polygon",
  source_net_id: net.source_net_id,
  layer: "top",
  points: vertices,
})
const via = (x = 9.5) => ({
  type: "pcb_via",
  pcb_via_id: "pcb_via_1",
  x,
  y: 2.5,
  outer_diameter: 0.6,
  hole_diameter: 0.3,
  layers: ["top", "bottom"],
  source_net_id: net.source_net_id,
})
const circuit = (...elements: unknown[]) =>
  [net, ...elements] as AnyCircuitElement[]
const check = (...elements: unknown[]) =>
  checkCopperPourDeadEndFingers(circuit(...elements))

test("reports one nonfatal diagnostic per finger with readable net, layer and position", () => {
  const errors = check(pour())
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_placement_error",
    is_fatal: false,
    pcb_placement_error_id: "copper_pour_dead_end_finger_pcb_copper_pour_1_0",
  })
  expect(errors[0].message).toContain("GND")
  expect(errors[0].message).toContain("on top")
  expect(errors[0].message).toContain("10.00mm")
  expect(errors[0].message).not.toContain("source_net_1")
  expect(errors[0].message).not.toContain("pcb_copper_pour_1")
  const unnamed = checkCopperPourDeadEndFingers([
    { ...pour(), source_net_id: undefined },
  ] as AnyCircuitElement[])
  expect(unnamed[0].message).toContain("unnamed copper pour")
  expect(unnamed[0].message).not.toContain("pcb_copper_pour_1")
})

test("is invariant to winding, translation, rotation and straight-edge subdivision", () => {
  for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
    const vertices = outline().map(({ x, y }) => ({
      x: x * Math.cos(angle) - y * Math.sin(angle) - 12.3,
      y: x * Math.sin(angle) + y * Math.cos(angle) + 20.7,
    }))
    expect(check(pour(vertices))).toHaveLength(1)
    expect(check(pour(vertices.toReversed()))).toHaveLength(1)
  }
  const vertices = outline()
  vertices.splice(3, 0, { x: 5.00001, y: 2 }, { x: 8, y: 2 })
  expect(check(pour(vertices))).toHaveLength(1)
})

test("does not flag broad lobes, short stubs, rectangles, or narrow bridges", () => {
  expect(check()).toEqual([])
  expect(check(pour(outline(1)))).toEqual([])
  expect(check(pour(outline(5, 2)))).toEqual([])
  expect(
    check(
      pour(
        points([
          [0, 0],
          [10, 0],
          [10, 1],
          [0, 1],
        ]),
      ),
    ),
  ).toEqual([])
  const bridge = points([
    [0, 0],
    [5, 0],
    [5, 2],
    [10, 2],
    [10, 0],
    [15, 0],
    [15, 6],
    [10, 6],
    [10, 3],
    [5, 3],
    [5, 6],
    [0, 6],
  ])
  expect(check(pour(bridge))).toEqual([])
})

test("supports adjustable dimensional thresholds and rejects invalid options", () => {
  const input = circuit(pour())
  for (const options of [
    { maxWidth: 0.9 },
    { minLength: 6 },
    { minAspectRatio: 6 },
  ]) {
    expect(checkCopperPourDeadEndFingers(input, options)).toEqual([])
  }
  expect(
    checkCopperPourDeadEndFingers(circuit(pour(outline(6, 1.5))), {
      maxWidth: 1.5,
    }),
  ).toHaveLength(1)
  for (const key of ["maxWidth", "minLength", "minAspectRatio"]) {
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        checkCopperPourDeadEndFingers(input, { [key]: value }),
      ).toThrow(RangeError)
    }
  }
})

test("keeps rounded BRep caps, bent fingers, and independent branches", () => {
  const vertices = outline().map((point, i) => ({
    ...point,
    bulge: i === 3 ? 1 : 0,
  }))
  expect(
    check({
      ...pour(),
      shape: "brep",
      brep_shape: { outer_ring: { vertices }, inner_rings: [] },
    }),
  ).toHaveLength(1)
  expect(
    check(
      pour(
        points([
          [0, 0],
          [5, 0],
          [5, 2],
          [9, 2],
          [9, 8],
          [8, 8],
          [8, 3],
          [5, 3],
          [5, 6],
          [0, 6],
        ]),
      ),
    ),
  ).toHaveLength(1)
  const twoFingers = points([
    [0, 0],
    [5, 0],
    [5, 1],
    [10, 1],
    [10, 2],
    [5, 2],
    [5, 4],
    [10, 4],
    [10, 5],
    [5, 5],
    [5, 6],
    [0, 6],
  ])
  expect(check(pour(twoFingers))).toHaveLength(2)
})

test("respects cutouts and does not mistake copper connected around a hole for a finger", () => {
  for (const reverse of [false, true]) {
    const inner = points([
      [1, 1],
      [4, 1],
      [4, 5],
      [1, 5],
    ])
    if (reverse) inner.reverse()
    expect(
      check({
        ...pour(),
        shape: "brep",
        brep_shape: {
          outer_ring: { vertices: outline() },
          inner_rings: [{ vertices: inner }],
        },
      }),
    ).toHaveLength(1)
    expect(
      check({
        ...pour(),
        shape: "brep",
        brep_shape: {
          outer_ring: {
            vertices: points([
              [0, 0],
              [10, 0],
              [10, 6],
              [0, 6],
            ]),
          },
          inner_rings: [
            {
              vertices: points([
                [1, 1],
                [9, 1],
                [9, 5],
                [1, 5],
              ]),
            },
          ],
        },
      }),
    ).toEqual([])
  }
})

test("finds smooth concave roots without requiring a sharp corner", () => {
  const vertices = points([
    [0, 0],
    [5, 0],
    [5, 1.5],
    [5.5, 2],
    [10, 2],
    [10, 3],
    [5.5, 3],
    [5, 3.5],
    [5, 6],
    [0, 6],
  ]).map((point, i) => ({
    ...point,
    bulge: i === 2 || i === 6 ? -Math.tan(Math.PI / 8) : 0,
  }))
  expect(
    check({
      ...pour(),
      shape: "brep",
      brep_shape: { outer_ring: { vertices }, inner_rings: [] },
    }),
  ).toHaveLength(1)
})

test("detects a copper finger extending into a BRep cutout", () => {
  expect(
    check({
      ...pour(),
      shape: "brep",
      brep_shape: {
        outer_ring: {
          vertices: points([
            [0, 0],
            [15, 0],
            [15, 10],
            [0, 10],
          ]),
        },
        inner_rings: [
          {
            vertices: points([
              [2, 1],
              [13, 1],
              [13, 9],
              [2, 9],
              [2, 5],
              [7, 5],
              [7, 4],
              [2, 4],
            ]),
          },
        ],
      },
    }),
  ).toHaveLength(1)
})

test("exempts a same-net via near the tip, but not a base via, foreign net or wrong layer", () => {
  expect(check(pour(), via())).toEqual([])
  expect(check(pour(), via(5))).toHaveLength(1)
  expect(
    check(pour(), { ...via(), source_net_id: "another_net" }),
  ).toHaveLength(1)
  expect(check(pour(), { ...via(), layers: ["bottom"] })).toHaveLength(1)
  // Through-via spans are expanded by the shared geometry converter.
  expect(check({ ...pour(), layer: "inner1" }, via())).toEqual([])
  expect(
    check(
      { ...pour(), layer: "bottom" },
      { ...via(), layers: ["top", "inner1"] },
    ),
  ).toHaveLength(1)
  expect(
    check(
      { ...pour(), layer: "inner1" },
      { ...via(), layers: ["top", "inner1", "bottom"] },
    ),
  ).toEqual([])
  // A drill void enclosing the distal branch is not copper contact.
  expect(
    check(pour(), { ...via(), outer_diameter: 20, hole_diameter: 18 }),
  ).toHaveLength(1)
})

test("resolves pad and trace connections through the logical net map", () => {
  const sourceTrace = {
    type: "source_trace",
    source_trace_id: "source_trace_1",
    connected_source_port_ids: ["source_port_1"],
    connected_source_net_ids: [net.source_net_id],
  }
  const port = {
    type: "pcb_port",
    pcb_port_id: "pcb_port_1",
    source_port_id: "source_port_1",
  }
  const pad = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_1",
    pcb_port_id: port.pcb_port_id,
    shape: "rect",
    x: 9.5,
    y: 2.5,
    width: 0.5,
    height: 0.5,
    layer: "top",
  }
  expect(check(pour(), pad, port, sourceTrace)).toEqual([])
  expect(check(pour(), pad)).toHaveLength(1)
  const trace = {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_1",
    source_trace_id: sourceTrace.source_trace_id,
    route: [2.5, 4].map((y) => ({
      route_type: "wire",
      x: 9.5,
      y,
      width: 0.2,
      layer: "top",
    })),
  }
  expect(check(pour(), trace, sourceTrace)).toEqual([])
  expect(
    check(pour(), { ...pad, layer: "bottom" }, port, sourceTrace),
  ).toHaveLength(1)
  expect(check(pour(), { ...pad, x: 5 }, port, sourceTrace)).toHaveLength(1)
  expect(
    check(
      pour(),
      {
        type: "pcb_plated_hole",
        pcb_plated_hole_id: "pcb_plated_hole_1",
        pcb_port_id: port.pcb_port_id,
        shape: "circle",
        x: 9.5,
        y: 2.5,
        outer_diameter: 0.6,
        hole_diameter: 0.3,
        layers: ["top", "bottom"],
      },
      port,
      sourceTrace,
    ),
  ).toEqual([])
})

test("unites same-net pours before checking, retaining fingers hidden by duplicate pours", () => {
  expect(
    check(pour(), { ...pour(), pcb_copper_pour_id: "duplicate" }),
  ).toHaveLength(1)
  const connection = {
    ...pour(),
    pcb_copper_pour_id: "second_pour",
    shape: "rect",
    center: { x: 12, y: 3 },
    width: 5,
    height: 6,
  }
  expect(check(pour(), connection)).toEqual([])
  expect(check(pour(), { ...connection, width: 4 })).toEqual([])
  expect(check(pour(), { ...connection, layer: "bottom" })).toHaveLength(1)
  expect(
    check(pour(), { ...connection, source_net_id: "different_net" }),
  ).toHaveLength(1)
  const disjoint = {
    ...pour(outline().map(({ x, y }) => ({ x: x + 30, y }))),
    pcb_copper_pour_id: "disjoint",
  }
  expect(check(pour(), disjoint)).toHaveLength(2)
})

test("a connected fork does not hide its unsupported child branch", () => {
  const fork = pour(
    points([
      [0, 0],
      [5, 0],
      [5, 2],
      [8, 2],
      [8, -4],
      [9, -4],
      [9, 8],
      [8, 8],
      [8, 3],
      [5, 3],
      [5, 6],
      [0, 6],
    ]),
  )
  const errors = check(fork, { ...via(8.5), y: 7.5 })
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("-4.00mm")
})

test("runs automatically with routing checks and leaves the supplied geometry unchanged", async () => {
  const input = circuit(pour())
  const original = structuredClone(input)
  const errors = await runAllRoutingChecks(input)
  expect(
    errors.some((error) => error.message.includes("dead-end finger")),
  ).toBe(true)
  expect(input).toEqual(original)
})
