import { expect, test } from "bun:test"
import type {
  AnyCircuitElement,
  PcbHoleWithPolygonPad,
  PcbSmtPadCircle,
  PcbTrace,
  PcbVia,
} from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import {
  checkEachPcbTraceNonOverlapping,
  checkPadPadClearance,
  checkPadTraceClearance,
  checkViaPadClearance,
  checkViasInPads,
} from "../../index"
import importedJson from "../fixtures/sparkfun-castellated/imported.circuit.json"

// SparkFun Electronics, CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
// Source: https://github.com/sparkfun/SparkFun-KiCad-Libraries/blob/acc8b2021b75b5ab07e48d7112ffdc6ca0393d0d/footprints/SparkFun-Connector.pretty/1x09_P2.54mm_Castellated.kicad_mod
const imported = importedJson as AnyCircuitElement[]
const pad = imported.find(
  (e): e is PcbHoleWithPolygonPad =>
    e.type === "pcb_plated_hole" && e.shape === "hole_with_polygon_pad",
)!

const placements: {
  name: string
  hole: PcbHoleWithPolygonPad
  componentRotation: number
  onCopper: { x: number; y: number }
  nearCopper: { x: number; y: number }
  horizontalTrace: boolean
}[] = [
  {
    name: "imported circular drill",
    hole: { ...pad, x: 10, y: -4 },
    componentRotation: 0,
    onCopper: { x: 10, y: -3 },
    nearCopper: { x: 10, y: -2.58 },
    horizontalTrace: true,
  },
  {
    name: "90 degree outline with an offset circular drill",
    hole: {
      ...pad,
      x: 10,
      y: -4,
      ccw_rotation: 90,
      hole_offset_x: 0.25,
      hole_offset_y: 0.1,
    },
    componentRotation: 0,
    onCopper: { x: 9, y: -4 },
    nearCopper: { x: 8.58, y: -4 },
    horizontalTrace: false,
  },
  {
    name: "offset slotted drill without hole_diameter",
    hole: {
      ...pad,
      x: 10,
      y: -4,
      ccw_rotation: 90,
      hole_shape: "rotated_pill",
      hole_diameter: undefined,
      hole_width: 0.6,
      hole_height: 0.4,
      hole_offset_x: 0.25,
      hole_offset_y: 0.1,
    },
    componentRotation: 0,
    onCopper: { x: 9, y: -4 },
    nearCopper: { x: 8.58, y: -4 },
    horizontalTrace: false,
  },
  {
    name: "explicit zero outline rotation overrides component rotation",
    hole: { ...pad, x: 10, y: -4, ccw_rotation: 0 },
    componentRotation: 90,
    onCopper: { x: 10, y: -3 },
    nearCopper: { x: 10, y: -2.58 },
    horizontalTrace: true,
  },
  {
    name: "component rotation when the outline has no explicit rotation",
    hole: { ...pad, x: 10, y: -4 },
    componentRotation: 90,
    onCopper: { x: 9, y: -4 },
    nearCopper: { x: 8.58, y: -4 },
    horizontalTrace: false,
  },
]

const makeCircuit = (
  placement: (typeof placements)[number],
  probes: AnyCircuitElement[],
  sameNet = false,
): AnyCircuitElement[] => [
  {
    type: "pcb_board",
    pcb_board_id: "board",
    center: { x: 10, y: -4 },
    width: 10,
    height: 10,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
  },
  ...imported
    .filter((e) => e.type !== "pcb_plated_hole")
    .map((e) => {
      if (e.type === "source_component") return { ...e, name: "J1" }
      if (e.type === "pcb_component")
        return {
          ...e,
          center: { x: placement.hole.x, y: placement.hole.y },
          rotation: placement.componentRotation,
        }
      if (e.type === "pcb_port")
        return { ...e, x: placement.hole.x, y: placement.hole.y }
      return e
    }),
  placement.hole,
  {
    type: "source_port",
    source_port_id: "pcb_component_0_port_1",
    source_component_id: "source_component_0",
    name: "1",
    pin_number: 1,
  },
  ...["ground", "signal"].map((id) => ({
    type: "source_net" as const,
    source_net_id: id,
    name: id === "ground" ? "GND" : "SIGNAL",
    member_source_group_ids: [],
  })),
  {
    type: "source_trace",
    source_trace_id: "ground_trace",
    connected_source_port_ids: ["pcb_component_0_port_1"],
    connected_source_net_ids: ["ground"],
  },
  {
    type: "source_port",
    source_port_id: "probe_source_port",
    name: "SIGNAL",
  },
  {
    type: "pcb_port",
    pcb_port_id: "probe_port",
    source_port_id: "probe_source_port",
    ...placement.onCopper,
    layers: ["top"],
  },
  {
    type: "source_trace",
    source_trace_id: "probe_source_trace",
    connected_source_port_ids: ["probe_source_port"],
    connected_source_net_ids: [sameNet ? "ground" : "signal"],
  },
  ...probes.map((e) =>
    e.type === "pcb_via"
      ? { ...e, source_net_id: sameNet ? "ground" : "signal" }
      : e,
  ),
]

const makeVia = (point: { x: number; y: number }): PcbVia => ({
  type: "pcb_via",
  pcb_via_id: "probe_via",
  ...point,
  outer_diameter: 0.4,
  hole_diameter: 0.2,
  layers: ["top", "bottom"],
})

const makePad = (point: { x: number; y: number }): PcbSmtPadCircle => ({
  type: "pcb_smtpad",
  pcb_smtpad_id: "probe_pad",
  pcb_port_id: "probe_port",
  ...point,
  shape: "circle",
  radius: 0.1,
  layer: "top",
})

const makeTrace = (
  point: { x: number; y: number },
  horizontal: boolean,
): PcbTrace => ({
  type: "pcb_trace",
  pcb_trace_id: "probe_trace",
  source_trace_id: "probe_source_trace",
  route: [-0.2, 0.2].map((offset) => ({
    route_type: "wire",
    x: point.x + (horizontal ? offset : 0),
    y: point.y + (horizontal ? 0 : offset),
    width: 0.2,
    layer: "top",
  })),
})

test("SparkFun castellated pad: foreign copper and the reported DRC overlay", async () => {
  const placement = placements[0]
  const circuit = makeCircuit(placement, [
    makeVia(placement.onCopper),
    makePad({ x: 11, y: -3 }),
    makeTrace(placement.nearCopper, true),
  ]).map((e) => (e.type === "pcb_board" ? { ...e, width: 4, height: 4 } : e))
  const viaInPad = checkViasInPads(circuit)
  const viaPad = checkViaPadClearance(circuit)
  const padPad = checkPadPadClearance(circuit)
  const padTrace = checkPadTraceClearance(circuit)
  const errors = [...viaInPad, ...viaPad, ...padPad, ...padTrace]
  await expect(
    convertCircuitJsonToPcbSvg([...circuit, ...errors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
      width: 900,
      height: 900,
      viewport: { minX: 7.7, maxX: 12.3, minY: -6.3, maxY: -1.7 },
    }),
  ).toMatchSvgSnapshot(import.meta.path)
  expect({
    viaInPad: viaInPad.length,
    viaPad: viaPad.length,
    padPad: padPad.length,
    padTrace: padTrace.length,
  }).toEqual({ viaInPad: 1, viaPad: 1, padPad: 1, padTrace: 1 })
})

for (const placement of placements) {
  test(`SparkFun polygon pad detects foreign copper beyond the drill: ${placement.name}`, () => {
    const { onCopper, horizontalTrace } = placement
    const viaCircuit = makeCircuit(placement, [makeVia(onCopper)])
    const viaInPadErrors = checkViasInPads(viaCircuit)
    const viaPadErrors = checkViaPadClearance(viaCircuit)
    const padErrors = checkPadPadClearance(
      makeCircuit(placement, [makePad(onCopper)]),
    )
    const traceCircuit = makeCircuit(placement, [
      makeTrace(onCopper, horizontalTrace),
    ])
    expect({
      viaInPad: viaInPadErrors.length,
      viaPad: viaPadErrors.length,
      padPad: padErrors.length,
      traceOverlap: checkEachPcbTraceNonOverlapping(traceCircuit).length,
    }).toEqual({ viaInPad: 1, viaPad: 1, padPad: 1, traceOverlap: 1 })
    expect(viaPadErrors[0].pcb_pad_ids).toEqual([
      "probe_via",
      pad.pcb_plated_hole_id,
    ])
    expect(padErrors[0].pcb_pad_ids).toContain(pad.pcb_plated_hole_id)
    expect(checkPadTraceClearance(traceCircuit)).toEqual([])
  })

  test(`SparkFun polygon pad measures 0.05mm copper clearance: ${placement.name}`, () => {
    const { nearCopper, horizontalTrace } = placement
    const via = makeVia(nearCopper)
    if (horizontalTrace) via.y += 0.1
    else via.x -= 0.1
    const viaCircuit = makeCircuit(placement, [via])
    expect(checkViasInPads(viaCircuit)).toEqual([])
    const viaErrors = checkViaPadClearance(viaCircuit)
    expect(viaErrors).toHaveLength(1)
    expect(viaErrors[0].actual_clearance).toBeCloseTo(0.05, 6)
    const padErrors = checkPadPadClearance(
      makeCircuit(placement, [makePad(nearCopper)]),
    )
    expect(padErrors).toHaveLength(1)
    expect(padErrors[0].actual_clearance).toBeCloseTo(0.05, 6)
    const traceCircuit = makeCircuit(placement, [
      makeTrace(nearCopper, horizontalTrace),
    ])
    const traceErrors = checkPadTraceClearance(traceCircuit)
    expect(traceErrors).toHaveLength(1)
    expect(traceErrors[0].actual_clearance).toBeCloseTo(0.05, 6)
    expect(checkEachPcbTraceNonOverlapping(traceCircuit)).toEqual([])
  })
}

test("same-net copper stays exempt, while a via drill in the pad still needs permission", () => {
  const placement = placements[1]
  const viaCircuit = makeCircuit(placement, [makeVia(placement.onCopper)], true)
  expect(checkViaPadClearance(viaCircuit)).toEqual([])
  expect(checkViasInPads(viaCircuit)).toHaveLength(1)
  expect(
    checkViasInPads(
      viaCircuit.map((e) =>
        e.type === "pcb_board" ? { ...e, is_via_in_pad_allowed: true } : e,
      ),
    ),
  ).toEqual([])
  expect(
    checkPadPadClearance(
      makeCircuit(placement, [makePad(placement.onCopper)], true),
    ),
  ).toEqual([])
  const traceCircuit = makeCircuit(
    placement,
    [makeTrace(placement.onCopper, false)],
    true,
  )
  expect(checkEachPcbTraceNonOverlapping(traceCircuit)).toEqual([])
  expect(checkPadTraceClearance(traceCircuit)).toEqual([])
})

test("the rounded end's empty bounding-box corner is not copper", () => {
  const placement = placements[0]
  const point = { x: 10.7, y: -4.7 }
  const via = { ...makeVia(point), outer_diameter: 0.08, hole_diameter: 0.04 }
  const viaCircuit = makeCircuit(placement, [via])
  expect(checkViasInPads(viaCircuit)).toEqual([])
  expect(checkViaPadClearance(viaCircuit)).toEqual([])
  expect(
    checkPadPadClearance(
      makeCircuit(placement, [{ ...makePad(point), radius: 0.04 }]),
    ),
  ).toEqual([])
  const trace = makeTrace(point, true)
  trace.route = [
    { route_type: "wire", x: 10.68, y: -4.7, width: 0.08, layer: "top" },
    { route_type: "wire", x: 10.72, y: -4.7, width: 0.08, layer: "top" },
  ]
  const traceCircuit = makeCircuit(placement, [trace])
  expect(checkEachPcbTraceNonOverlapping(traceCircuit)).toEqual([])
  expect(checkPadTraceClearance(traceCircuit)).toEqual([])
})

test("via copper contact without drill intrusion does not count as via-in-pad", () => {
  const placement = placements[1]
  const circuit = makeCircuit(placement, [makeVia(placement.nearCopper)])
  expect(checkViasInPads(circuit)).toEqual([])
  const errors = checkViaPadClearance(circuit)
  expect(errors).toHaveLength(1)
  expect(errors[0].actual_clearance).toBe(0)
})

test("polygon-pad diagnostics use a readable pin name and an honest unnamed fallback", () => {
  const placement = placements[0]
  const circuit = makeCircuit(placement, [makeVia(placement.onCopper)])
  const named = checkViasInPads(circuit)
  expect(named[0]?.message).toContain("J1")
  const unnamed = checkViasInPads([
    { ...placement.hole, pcb_component_id: undefined, pcb_port_id: undefined },
    makeVia(placement.onCopper),
  ])
  expect(unnamed).toHaveLength(1)
  expect(unnamed[0].message).toContain("through-hole pad")
  expect(unnamed[0].message).not.toContain(pad.pcb_plated_hole_id)
})
