import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbCutout, PcbTrace } from "circuit-json"
import { checkCopperToCutoutClearance } from "../../index"

const cutout: PcbCutout = {
  type: "pcb_cutout",
  pcb_cutout_id: "pcb_cutout_local",
  shape: "rect",
  center: { x: 0, y: 0 },
  width: 2,
  height: 1,
}
const patternedSlot = (offset: number): PcbCutout => ({
  type: "pcb_cutout",
  pcb_cutout_id: "pcb_cutout_patterned",
  shape: "path",
  route: [
    { x: offset, y: offset - 1 },
    { x: offset, y: offset + 1 },
  ],
  slot_width: 0.5,
  slot_length: 0.5,
  space_between_slots: 0.5,
})
const trace = (offset: number, invalidTransition = false): PcbTrace => ({
  type: "pcb_trace",
  pcb_trace_id: "pcb_trace_signal",
  route: [
    { route_type: "wire", x: offset - 2, y: offset, width: 0.3, layer: "top" },
    {
      route_type: "wire",
      x: offset + 2,
      y: offset,
      width: 0.3,
      layer: invalidTransition ? "bottom" : "top",
    },
  ],
})

test("does not blame a distant patterned slot for unrelated copper", () => {
  expect(checkCopperToCutoutClearance([patternedSlot(30), trace(0)])).toEqual(
    [],
  )
})

test("does not blame a cutout for a distant invalid layer transition", () => {
  expect(checkCopperToCutoutClearance([cutout, trace(30, true)])).toEqual([])
})

test("still reports a nearby unsupported patterned slot", () => {
  const errors = checkCopperToCutoutClearance([patternedSlot(0), trace(0)])
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain(
    "Cannot verify copper-to-cutout clearance",
  )
})

test("still reports a nearby invalid trace", () => {
  expect(checkCopperToCutoutClearance([cutout, trace(0, true)])).toHaveLength(1)
})

test("bounds both failed conversions before deciding they are unrelated", () => {
  expect(
    checkCopperToCutoutClearance([patternedSlot(30), trace(0, true)]),
  ).toEqual([])
  expect(
    checkCopperToCutoutClearance([patternedSlot(0), trace(0, true)]),
  ).toHaveLength(2)
})

test("unrelated converter warnings do not hide a real cutout intersection", () => {
  const errors = checkCopperToCutoutClearance([
    cutout,
    patternedSlot(30),
    trace(0),
  ])
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("violates clearance to cutout")
})

test("keeps the diagnostic when a failed trace has no trustworthy XY bounds", () => {
  const invalid = trace(30, true)
  invalid.route[0] = {
    route_type: "wire",
    x: NaN,
    y: 30,
    width: 0.3,
    layer: "top",
  }
  const errors = checkCopperToCutoutClearance([cutout, invalid])
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain(
    "Cannot verify copper-to-cutout clearance",
  )
})

test("does not shrink a wide segment to the next point's narrower width", () => {
  const invalid: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_wide",
    route: [
      { route_type: "wire", x: 30, y: 30, width: 4, layer: "top" },
      { route_type: "wire", x: 0, y: 1, width: 0.1, layer: "bottom" },
    ],
  }
  expect(checkCopperToCutoutClearance([cutout, invalid])).toHaveLength(1)
})

test("includes the configured board-edge clearance when scoping warnings", () => {
  const board: AnyCircuitElement = {
    type: "pcb_board",
    pcb_board_id: "pcb_board_clearance",
    center: { x: 0, y: 0 },
    width: 100,
    height: 100,
    num_layers: 4,
    thickness: 1.6,
    material: "fr4",
    min_board_edge_clearance: 0.2,
  }
  const near: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_near",
    route: [
      { route_type: "wire", x: -2, y: 0.84, width: 0.3, layer: "top" },
      { route_type: "wire", x: 2, y: 0.84, width: 0.3, layer: "bottom" },
    ],
  }
  expect(checkCopperToCutoutClearance([board, cutout, near])).toHaveLength(1)
})

test("uses a valid outer via envelope even when its drill cannot be converted", () => {
  const invalidVia: AnyCircuitElement = {
    type: "pcb_via",
    pcb_via_id: "pcb_via_bad_drill",
    x: 30,
    y: 30,
    outer_diameter: 0.6,
    hole_diameter: -0.3,
    layers: ["top", "bottom"],
  }
  expect(checkCopperToCutoutClearance([cutout, invalidVia])).toEqual([])
  expect(
    checkCopperToCutoutClearance([cutout, { ...invalidVia, x: 0, y: 0 }]),
  ).toHaveLength(1)
})

test("custom corner geometry remains unverified when no safe envelope is available", () => {
  const custom = { ...patternedSlot(30), slot_corner_radius: 1 }
  expect(checkCopperToCutoutClearance([custom, trace(0)])).toHaveLength(1)
})

for (const display_name of ["ADC_SENSE", undefined]) {
  test(`nearby warnings keep ${display_name ? "readable names" : "honest unnamed labels"}`, () => {
    const errors = checkCopperToCutoutClearance([
      cutout,
      {
        type: "source_trace",
        source_trace_id: "source_trace_warning",
        display_name,
        connected_source_port_ids: [],
        connected_source_net_ids: [],
      },
      { ...trace(0, true), source_trace_id: "source_trace_warning" },
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain(display_name ?? "unnamed trace")
    expect(errors[0].message).not.toMatch(
      /pcb_trace_signal|source_trace_warning|pcb_cutout_local/,
    )
  })
}
