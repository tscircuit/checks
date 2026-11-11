import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"
import { runAllPlacementChecks } from "lib/run-all-checks"

test("component-owned non-plated hole is checked even when component also has pads", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "connector_pad_1",
      pcb_component_id: "connector",
      shape: "rect",
      x: -5,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "connector_boss_hole",
      pcb_component_id: "connector",
      hole_shape: "circle",
      x: 2,
      y: 0,
      hole_diameter: 1.6,
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "resistor_pad_1",
      pcb_component_id: "resistor",
      shape: "rect",
      x: 2,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
  ]

  const errors = checkPcbComponentOverlap(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_hole_ids).toEqual(["connector_boss_hole"])
  expect(errors[0].pcb_smtpad_ids).toEqual(["resistor_pad_1"])
  expect(errors[0].pcb_component_ids).toEqual(["connector", "resistor"])
})

test("all non-plated holes of a multi-hole component are checked", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_hole",
      pcb_hole_id: "bracket_hole_1",
      pcb_component_id: "bracket",
      hole_shape: "circle",
      x: -4,
      y: 0,
      hole_diameter: 2,
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "bracket_hole_2",
      pcb_component_id: "bracket",
      hole_shape: "circle",
      x: 4,
      y: 0,
      hole_diameter: 2,
    },
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "ic_courtyard",
      pcb_component_id: "ic",
      center: { x: 4, y: 0 },
      width: 3,
      height: 3,
      layer: "top",
    },
  ]

  const errors = checkPcbComponentOverlap(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_hole_ids).toEqual(["bracket_hole_2"])
  expect(errors[0].pcb_component_ids).toEqual(["bracket", "ic"])
})

test("component-owned hole is not compared against its own component elements", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "connector_pad_1",
      pcb_component_id: "connector",
      shape: "rect",
      x: 0,
      y: 0,
      width: 2,
      height: 2,
      layer: "top",
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "connector_boss_hole",
      pcb_component_id: "connector",
      hole_shape: "circle",
      x: 0,
      y: 0,
      hole_diameter: 1,
    },
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "connector_courtyard",
      pcb_component_id: "connector",
      center: { x: 0, y: 0 },
      width: 4,
      height: 4,
      layer: "top",
    },
  ]

  expect(checkPcbComponentOverlap(circuitJson)).toHaveLength(0)
})

test("runAllPlacementChecks consolidates component-owned hole overlaps", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "src_conn",
      name: "J1",
      ftype: "simple_chip",
    },
    {
      type: "source_component",
      source_component_id: "src_r1",
      name: "R1",
      ftype: "simple_resistor",
      resistance: 1000,
    },
    {
      type: "pcb_component",
      pcb_component_id: "conn",
      source_component_id: "src_conn",
      center: { x: 0, y: 0 },
      width: 6,
      height: 2,
      layer: "top",
      rotation: 0,
      obstructs_within_bounds: false,
    },
    {
      type: "pcb_component",
      pcb_component_id: "r1",
      source_component_id: "src_r1",
      center: { x: 1, y: 0 },
      width: 4,
      height: 2,
      layer: "top",
      rotation: 0,
      obstructs_within_bounds: false,
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "conn_pad",
      pcb_component_id: "conn",
      shape: "rect",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    {
      type: "pcb_hole",
      pcb_hole_id: "conn_hole",
      pcb_component_id: "conn",
      hole_shape: "circle",
      x: 2,
      y: 0,
      hole_diameter: 1.5,
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "r1_pad_1",
      pcb_component_id: "r1",
      shape: "rect",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "r1_pad_2",
      pcb_component_id: "r1",
      shape: "rect",
      x: 2,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "conn_cy",
      pcb_component_id: "conn",
      center: { x: 1, y: 0 },
      width: 4,
      height: 2,
      layer: "top",
    },
    {
      type: "pcb_courtyard_rect",
      pcb_courtyard_rect_id: "r1_cy",
      pcb_component_id: "r1",
      center: { x: 1, y: 0 },
      width: 4,
      height: 2,
      layer: "top",
    },
  ]

  const issues = await runAllPlacementChecks(circuitJson)
  const overlapErrors = issues.filter(
    (issue) => issue.type === "pcb_footprint_overlap_error",
  )

  expect(overlapErrors).toHaveLength(1)
  expect(overlapErrors[0].pcb_hole_ids).toEqual(["conn_hole"])
  expect(overlapErrors[0].pcb_smtpad_ids).toEqual([
    "conn_pad",
    "r1_pad_1",
    "r1_pad_2",
  ])
})
