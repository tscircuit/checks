import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import {
  consolidatePcbOverlapErrors,
  type PcbComponentOverlapError,
} from "../../lib/consolidate-pcb-overlap-errors"
import { runAllPlacementChecks } from "../../lib/run-all-checks"

function fixture(offset = 0.5) {
  const db = cju([])
  db.pcb_board.insert({
    center: { x: 1.5, y: 0 },
    width: 20,
    height: 12,
    num_layers: 2,
    thickness: 1.6,
    material: "fr4",
  })
  for (const [name, x] of [
    ["U1", 0],
    ["U2", offset],
  ] as const) {
    const source = db.source_component.insert({ name, ftype: "simple_chip" })
    const component = db.pcb_component.insert({
      source_component_id: source.source_component_id,
      center: { x, y: 0 },
      width: 5,
      height: 3,
      layer: "top",
      rotation: 0,
      obstructs_within_bounds: true,
    })
    for (const padX of [x, x + 3]) {
      db.pcb_plated_hole.insert({
        pcb_component_id: component.pcb_component_id,
        shape: "circle",
        x: padX,
        y: 0,
        outer_diameter: 2,
        hole_diameter: 1,
        layers: ["top", "bottom"],
      })
    }
    db.pcb_courtyard_rect.insert({
      pcb_component_id: component.pcb_component_id,
      center: { x: x + 1.5, y: 0 },
      width: 6,
      height: 3,
      layer: "top",
    })
  }
  return db.toArray()
}

test("consolidates overlaps and clearance by component pair, preserving details and geometry", async () => {
  const circuitJson = fixture()
  const raw = await runAllPlacementChecks(circuitJson, {
    consolidateOverlaps: false,
  })
  const before = structuredClone(raw)
  const consolidated = await runAllPlacementChecks(circuitJson)
  const summaries = consolidated.filter(
    (e) => e.type === "pcb_footprint_overlap_error",
  ) as PcbComponentOverlapError[]
  expect(summaries).toHaveLength(1)
  expect(summaries[0].message).toContain("U1 overlaps U2")
  expect(summaries[0].message).toContain("pad clearance violations")
  expect(summaries[0].pcb_plated_hole_ids).toHaveLength(4)
  expect(summaries[0].related_errors as AnyCircuitElement[]).toEqual(
    raw.filter((e) =>
      [
        "pcb_footprint_overlap_error",
        "pcb_pad_pad_clearance_error",
        "pcb_courtyard_overlap_error",
      ].includes(e.type),
    ),
  )
  expect(
    consolidated.some(
      (e) =>
        e.type === "pcb_pad_pad_clearance_error" ||
        e.type === "pcb_courtyard_overlap_error",
    ),
  ).toBe(false)
  expect(consolidatePcbOverlapErrors(circuitJson, consolidated)).toEqual(
    consolidated,
  )
  expect(raw).toEqual(before)
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...consolidated], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})

test("keeps clearance-only, same-component, standalone and unrelated diagnostics", async () => {
  const circuitJson = fixture()
  const raw = await runAllPlacementChecks(circuitJson, {
    consolidateOverlaps: false,
  })
  const clearanceOnly = raw.filter(
    (e) => e.type !== "pcb_footprint_overlap_error",
  )
  expect(consolidatePcbOverlapErrors(circuitJson, clearanceOnly)).toEqual(
    clearanceOnly,
  )
  const standalone = circuitJson.map((e) => {
    if (e.type !== "pcb_plated_hole") return e
    const { pcb_component_id, ...hole } = e
    return hole
  })
  const standaloneErrors = await runAllPlacementChecks(standalone, {
    consolidateOverlaps: false,
  })
  expect(consolidatePcbOverlapErrors(standalone, standaloneErrors)).toEqual(
    standaloneErrors,
  )
  const unrelated: AnyCircuitElement = {
    type: "pcb_trace_error",
    pcb_trace_error_id: "trace_problem",
    error_type: "pcb_trace_error",
    message: "Trace overlaps a pad",
    pcb_trace_id: "trace1",
    source_trace_id: "source_trace1",
    pcb_component_ids: [],
    pcb_port_ids: [],
  }
  expect(
    consolidatePcbOverlapErrors(circuitJson, [...raw, unrelated]),
  ).toContain(unrelated)
  const sameComponent = circuitJson.map((e) =>
    e.type === "pcb_plated_hole"
      ? { ...e, pcb_component_id: "same_component" }
      : e,
  )
  expect(consolidatePcbOverlapErrors(sameComponent, clearanceOnly)).toEqual(
    clearanceOnly,
  )
})

test("does not merge distinct pairs that share a component", () => {
  const circuitJson = fixture()
  const errors: PcbComponentOverlapError[] = [
    ["a", "b"],
    ["b", "a"],
    ["b", "c"],
    ["c", "b"],
  ].map((pcb_component_ids, i) => ({
    type: "pcb_footprint_overlap_error",
    error_type: "pcb_footprint_overlap_error",
    pcb_error_id: `overlap_${i}`,
    message: "Overlap",
    pcb_component_ids,
  }))
  const summaries = consolidatePcbOverlapErrors(
    circuitJson,
    errors,
  ) as PcbComponentOverlapError[]
  expect(summaries).toHaveLength(2)
  expect(summaries.map((e) => e.pcb_component_ids)).toEqual([
    ["a", "b"],
    ["b", "c"],
  ])
  expect(summaries.map((e) => e.related_errors?.length)).toEqual([2, 2])
})
