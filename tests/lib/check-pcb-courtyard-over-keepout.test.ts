import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement, PCBKeepout } from "circuit-json"
import { checkPcbCourtyardOverKeepout } from "../../index"
import { checkPcbCopperOverKeepout } from "lib/check-pcb-copper-over-keepout"
import { runAllPlacementChecks } from "lib/run-all-checks"
import type { CourtyardElement } from "lib/util/courtyard-to-keepout"
import bt1Fixture from "../fixtures/bt1-mounting-hole-keepout.circuit.json"

const fixture = () => structuredClone(bt1Fixture) as AnyCircuitElement[]

// Reduced from rushabhcodes/ESP32-E-Reader 1.0.22: copper is clear, but the
// battery connector's courtyard enters the screw-head/standoff keepout.
test("BT1 courtyard violates mounting-hole keepout while copper stays clear", async () => {
  const circuit = fixture()
  expect(checkPcbCopperOverKeepout(circuit)).toEqual([])
  const errors = checkPcbCourtyardOverKeepout(circuit)
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_placement_error",
    pcb_placement_error_id:
      "courtyard_over_keepout_pcb_component_60_pcb_keepout_0",
  })
  expect(errors[0].message).toContain("BT1")
  expect(await runAllPlacementChecks(circuit)).toContainEqual(errors[0])
  expect(
    convertCircuitJsonToPcbSvg([...circuit, ...errors], {
      width: 1000,
      height: 800,
      viewport: { minX: -31, minY: 37, maxX: -17, maxY: 50 },
      showCourtyards: true,
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(
    import.meta.path,
    "bt1-courtyard-over-mounting-hole-keepout",
  )
})

test.each([
  { allow_placements: true },
  { excluded_pcb_component_ids: ["pcb_component_60"] },
  { layers: ["bottom", "inner1", "inner2"] },
])("respects keepout placement permissions and layers: %j", (overrides) => {
  const circuit = fixture().map((el) =>
    el.type === "pcb_keepout" ? { ...el, ...overrides } : el,
  ) as AnyCircuitElement[]
  expect(checkPcbCourtyardOverKeepout(circuit)).toEqual([])
})

test("does not suppress placements when only traces are allowed", () => {
  const circuit = fixture()
  const keepout = circuit.find((el) => el.type === "pcb_keepout")!
  keepout.allow_traces = true
  expect(checkPcbCourtyardOverKeepout(circuit)).toHaveLength(1)
})

test("skips do-not-place components", () => {
  const circuit = fixture()
  const component = circuit.find((el) => el.type === "pcb_component")!
  component.do_not_place = true
  expect(checkPcbCourtyardOverKeepout(circuit)).toEqual([])
})

test("advisory keepout emits one warning per component/keepout pair", () => {
  const circuit = fixture()
  const keepout = circuit.find((el) => el.type === "pcb_keepout")!
  keepout.warning_only = true
  keepout.description = "Screw head clearance"
  const courtyard = circuit.find((el) => el.type === "pcb_courtyard_outline")!
  circuit.push({ ...courtyard, pcb_courtyard_outline_id: "second_outline" })
  const errors = checkPcbCourtyardOverKeepout(circuit)
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_keepout_overlap_warning",
    pcb_keepout_id: "pcb_keepout_0",
    pcb_component_ids: ["pcb_component_60"],
  })
  expect(errors[0].message).toContain("Screw head clearance")
})

const common = { pcb_component_id: "pcb_component_60", layer: "top" as const }
const square = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
]
const courtyards: CourtyardElement[] = [
  {
    ...common,
    type: "pcb_courtyard_rect",
    pcb_courtyard_rect_id: "rect",
    center: { x: 0, y: 0 },
    width: 2,
    height: 2,
    ccw_rotation: 0,
  },
  {
    ...common,
    type: "pcb_courtyard_circle",
    pcb_courtyard_circle_id: "circle",
    center: { x: 0, y: 0 },
    radius: 1,
  },
  {
    ...common,
    type: "pcb_courtyard_outline",
    pcb_courtyard_outline_id: "outline",
    outline: square,
  },
  {
    ...common,
    type: "pcb_courtyard_polygon",
    pcb_courtyard_polygon_id: "polygon",
    points: square,
  },
]
const keepouts: PCBKeepout[] = [
  {
    type: "pcb_keepout",
    pcb_keepout_id: "k",
    layers: ["top"],
    shape: "rect",
    center: { x: 0, y: 0 },
    width: 0.5,
    height: 0.5,
  },
  {
    type: "pcb_keepout",
    pcb_keepout_id: "k",
    layers: ["top"],
    shape: "circle",
    center: { x: 0, y: 0 },
    radius: 0.25,
  },
  {
    type: "pcb_keepout",
    pcb_keepout_id: "k",
    layers: ["top"],
    shape: "outline",
    outline: square.map(({ x, y }) => ({ x: x * 0.25, y: y * 0.25 })),
    stroke_width: 0,
  },
]
for (const courtyard of courtyards) {
  for (const keepout of keepouts) {
    test(`${courtyard.type} detects contained ${keepout.shape} keepout`, () => {
      expect(checkPcbCourtyardOverKeepout([courtyard, keepout])).toHaveLength(1)
    })
  }
}

test("rotated rectangular courtyard uses its rotated geometry", () => {
  const courtyard: CourtyardElement = {
    ...common,
    type: "pcb_courtyard_rect",
    pcb_courtyard_rect_id: "r",
    center: { x: 0, y: 0 },
    width: 6,
    height: 0.5,
    ccw_rotation: 90,
  }
  const keepout: PCBKeepout = {
    type: "pcb_keepout",
    pcb_keepout_id: "k",
    layers: ["top"],
    shape: "circle",
    center: { x: 0, y: 2 },
    radius: 0.2,
  }
  expect(checkPcbCourtyardOverKeepout([courtyard, keepout])).toHaveLength(1)
  expect(
    checkPcbCourtyardOverKeepout([{ ...courtyard, ccw_rotation: 0 }, keepout]),
  ).toEqual([])
})

test("concave courtyard does not flag a keepout in its empty notch", () => {
  const courtyard: CourtyardElement = {
    ...common,
    type: "pcb_courtyard_outline",
    pcb_courtyard_outline_id: "l",
    outline: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 4 },
      { x: 0, y: 4 },
    ],
  }
  const keepout: PCBKeepout = {
    type: "pcb_keepout",
    pcb_keepout_id: "k",
    layers: ["top"],
    shape: "circle",
    center: { x: 3, y: 3 },
    radius: 0.4,
  }
  expect(checkPcbCourtyardOverKeepout([courtyard, keepout])).toEqual([])
})

test("multiple overlapping courtyard elements produce one hard error", () => {
  expect(
    checkPcbCourtyardOverKeepout([...courtyards, keepouts[0]!]),
  ).toHaveLength(1)
})
