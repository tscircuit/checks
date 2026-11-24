import { expect, test } from "bun:test"
import type { AnyCircuitElement, PCBKeepout, PcbComponent } from "circuit-json"
import { checkCourtyardOverlap } from "lib/check-courtyard-overlap/checkCourtyardOverlap"
import { checkPcbCourtyardOverKeepout } from "lib/check-pcb-courtyard-over-keepout"
import { checkPcbCopperOverKeepout } from "lib/check-pcb-copper-over-keepout"
import { checkPcbComponentsMissingCourtyard } from "lib/check-pcb-components-missing-courtyard"
import { runAllPlacementChecks } from "lib/run-all-checks"
import { containsCircuitJsonId } from "lib/util/get-readable-names"
import rvboy from "../fixtures/rvboy-missing-courtyard.circuit.json"

const fixture = () => structuredClone(rvboy) as AnyCircuitElement[]
const chipOnly = () =>
  fixture().filter(
    (el) =>
      !("pcb_component_id" in el) ||
      el.pcb_component_id === "pcb_component_202",
  )
const chip = (c: AnyCircuitElement[]) =>
  c.find(
    (el): el is PcbComponent =>
      el.type === "pcb_component" &&
      el.pcb_component_id === "pcb_component_202",
  )!
const keepout: PCBKeepout = {
  type: "pcb_keepout",
  pcb_keepout_id: "body_keepout",
  description: "Flex insertion clearance",
  layers: ["top"],
  shape: "rect",
  center: { x: -46, y: 21.5 },
  width: 2,
  height: 2,
}

test("RVboy: U_KEYS without a courtyard overlaps SW_L's courtyard", async () => {
  const c = fixture()
  const errors = checkCourtyardOverlap(c)
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("bounds of U_KEYS")
  expect(errors[0].message).toContain("Courtyard of SW_L")
  expect(errors[0].pcb_component_ids).toEqual(
    expect.arrayContaining(["pcb_component_202", "pcb_component_225"]),
  )
  expect(
    await runAllPlacementChecks(c, { consolidateOverlaps: false }),
  ).toContainEqual(errors[0])
  expect(
    (await runAllPlacementChecks(c)).some((e) => e.type.endsWith("_error")),
  ).toBe(true)
  // Detection must not hide the missing geometry warning.
  expect(checkPcbComponentsMissingCourtyard(c)).toHaveLength(1)
})

test("component body in explicit keepout is caught even though pads clear it", async () => {
  const c = [...chipOnly(), keepout]
  expect(checkPcbCopperOverKeepout(c)).toEqual([])
  const errors = checkPcbCourtyardOverKeepout(c)
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toBe(
    'Bounds of U_KEYS overlap PCB keepout "Flex insertion clearance"',
  )
  expect(await runAllPlacementChecks(c)).toContainEqual(errors[0])
})

test.each([
  { allow_placements: true },
  { excluded_pcb_component_ids: ["pcb_component_202"] },
  { layers: ["bottom"] },
])("fallback respects keepout permissions/layers: %j", (overrides) => {
  expect(
    checkPcbCourtyardOverKeepout([
      ...chipOnly(),
      { ...keepout, ...overrides } as PCBKeepout,
    ]),
  ).toEqual([])
})

test("fallback respects advisory keepouts and still checks trace-permitted keepouts", () => {
  expect(
    checkPcbCourtyardOverKeepout([
      ...chipOnly(),
      { ...keepout, warning_only: true },
    ])[0].type,
  ).toBe("pcb_keepout_overlap_warning")
  expect(
    checkPcbCourtyardOverKeepout([
      ...chipOnly(),
      { ...keepout, allow_traces: true },
    ])[0].type,
  ).toBe("pcb_placement_error")
})

test.each(["do_not_place", "bottom"])(
  "fallback skips %s components",
  (mode) => {
    const c = fixture()
    const component = chip(c)
    if (mode === "do_not_place") component.do_not_place = true
    else component.layer = "bottom"
    expect(checkCourtyardOverlap(c)).toEqual([])
    expect(checkPcbCourtyardOverKeepout([...c, keepout])).toEqual([])
  },
)

test("explicit courtyard is authoritative even if component bounds are larger", () => {
  const c = fixture()
  c.push({
    type: "pcb_courtyard_rect",
    pcb_courtyard_rect_id: "explicit",
    pcb_component_id: "pcb_component_202",
    layer: "top",
    center: { x: -46, y: 15 },
    width: 2,
    height: 2,
    ccw_rotation: 0,
  })
  expect(checkCourtyardOverlap(c)).toEqual([])
  expect(checkPcbCourtyardOverKeepout([...c, keepout])).toEqual([])
})

test("world-aligned component bounds are not rotated a second time", () => {
  const c = chipOnly()
  const component = chip(c)
  component.rotation = 90
  component.width = 2
  component.height = 10
  const tip = {
    ...keepout,
    center: { x: -46, y: 25.5 },
    width: 0.5,
    height: 0.5,
  }
  expect(checkPcbCourtyardOverKeepout([...c, tip])).toHaveLength(1)
  expect(
    checkPcbCourtyardOverKeepout([
      ...c,
      { ...tip, center: { x: -42, y: 21.5 } },
    ]),
  ).toEqual([])
})

test("fallback diagnostics use readable labels for unnamed elements", () => {
  const c = fixture().filter((el) => el.type !== "source_component")
  const errors = [
    ...checkCourtyardOverlap(c),
    ...checkPcbCourtyardOverKeepout([
      ...c,
      { ...keepout, description: undefined },
    ]),
  ]
  expect(errors).toHaveLength(2)
  for (const error of errors) {
    expect(error.message).toContain("unnamed component")
    expect(containsCircuitJsonId(error.message)).toBe(false)
  }
})

test.each(["simple_test_point", "manual_via"])(
  "does not invent component bodies for %s",
  (kind) => {
    const c: AnyCircuitElement[] = chipOnly().filter(
      (el) => el.type !== "source_component",
    )
    const id = chip(c).source_component_id!
    c.push(
      kind === "manual_via"
        ? {
            type: "source_manually_placed_via",
            source_manually_placed_via_id: id,
            source_group_id: "group",
          }
        : {
            type: "source_component",
            source_component_id: id,
            ftype: "simple_test_point",
            name: "TP1",
            supplier_part_numbers: {},
          },
    )
    expect(checkPcbCourtyardOverKeepout([...c, keepout])).toEqual([])
  },
)

test("separated bounds do not collide", () => {
  const c = fixture()
  chip(c).center = { x: -46, y: 0 }
  expect(checkCourtyardOverlap(c)).toEqual([])
  expect(checkPcbCourtyardOverKeepout([...c, keepout])).toEqual([])
})

test("non-obstructing component bounds are not treated as a solid body", () => {
  const c = fixture()
  chip(c).obstructs_within_bounds = false
  expect(checkCourtyardOverlap(c)).toEqual([])
  expect(checkPcbCourtyardOverKeepout([...c, keepout])).toEqual([])
})

test("overlapping components without either courtyard are detected", () => {
  const c = fixture().filter((el) => !el.type.startsWith("pcb_courtyard_"))
  chip(c).height += 2
  expect(checkCourtyardOverlap(c)).toHaveLength(1)
})

test("polygon courtyards are authoritative and participate in overlap checks", () => {
  const c = fixture().map((el) =>
    el.type === "pcb_courtyard_outline"
      ? {
          type: "pcb_courtyard_polygon" as const,
          pcb_courtyard_polygon_id: "polygon",
          pcb_component_id: el.pcb_component_id,
          layer: el.layer,
          points: el.outline,
        }
      : el,
  )
  expect(checkCourtyardOverlap(c)).toHaveLength(1)
})
