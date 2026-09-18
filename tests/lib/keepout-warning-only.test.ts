import { expect, test } from "bun:test"
import {
  any_circuit_element,
  type AnyCircuitElement,
  type PCBKeepout,
  type PcbTrace,
} from "circuit-json"
import { checkPcbCopperOverKeepout } from "lib/check-pcb-copper-over-keepout"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { runAllPlacementChecks, runAllRoutingChecks } from "lib/run-all-checks"

const keepouts: PCBKeepout[] = [
  {
    type: "pcb_keepout",
    pcb_keepout_id: "rect",
    shape: "rect",
    center: { x: 0, y: 0 },
    width: 8,
    height: 8,
    layers: ["top"],
  },
  {
    type: "pcb_keepout",
    pcb_keepout_id: "circle",
    shape: "circle",
    center: { x: 0, y: 0 },
    radius: 4,
    layers: ["top"],
  },
  {
    type: "pcb_keepout",
    pcb_keepout_id: "outline",
    shape: "outline",
    outline: [
      { x: -4, y: -4 },
      { x: 4, y: -4 },
      { x: 4, y: 4 },
      { x: -4, y: 4 },
    ],
    stroke_width: 0.1,
    layers: ["top"],
  },
]
const copper: AnyCircuitElement[] = [
  {
    type: "source_component",
    source_component_id: "source1",
    ftype: "simple_chip",
    name: "U1",
    supplier_part_numbers: {},
  },
  {
    type: "pcb_component",
    pcb_component_id: "component1",
    source_component_id: "source1",
    center: { x: -1, y: 0 },
    width: 3,
    height: 1,
    layer: "top",
    rotation: 0,
    obstructs_within_bounds: false,
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad1",
    pcb_component_id: "component1",
    shape: "rect",
    x: -2,
    y: 0,
    width: 0.5,
    height: 0.5,
    layer: "top",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad2",
    pcb_component_id: "component1",
    shape: "rect",
    x: -1,
    y: 0,
    width: 0.5,
    height: 0.5,
    layer: "top",
  },
  {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "hole1",
    pcb_component_id: "component1",
    shape: "circle",
    x: 0,
    y: 0,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
  },
  {
    type: "pcb_via",
    pcb_via_id: "via1",
    x: 2,
    y: 0,
    outer_diameter: 0.5,
    hole_diameter: 0.2,
    layers: ["top", "bottom"],
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "bottom",
    shape: "circle",
    x: 0,
    y: 2,
    radius: 0.2,
    layer: "bottom",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "outside",
    shape: "circle",
    x: 10,
    y: 2,
    radius: 0.2,
    layer: "top",
  },
]
const trace: PcbTrace = {
  type: "pcb_trace",
  pcb_trace_id: "trace1",
  subcircuit_id: "subcircuit1",
  route: [-6, 0, 6].map((x) => ({
    route_type: "wire" as const,
    x,
    y: 0,
    width: 0.1,
    layer: "top" as const,
  })),
}

for (const keepout of keepouts) {
  test(`${keepout.shape} advisory copper overlaps produce deduplicated, parseable warnings with all affected IDs`, async () => {
    const circuitJson: AnyCircuitElement[] = [
      ...copper,
      { ...keepout, warning_only: true },
    ]
    const before = JSON.stringify(circuitJson)
    const results = checkPcbCopperOverKeepout(circuitJson)
    expect(results).toHaveLength(2)
    expect(
      results.every((result) => result.type === "pcb_keepout_overlap_warning"),
    ).toBe(true)
    const componentWarning = results.find(
      (result) =>
        result.type === "pcb_keepout_overlap_warning" &&
        result.pcb_component_ids?.includes("component1"),
    )
    expect(componentWarning).toMatchObject({
      pcb_keepout_id: keepout.pcb_keepout_id,
      pcb_smtpad_ids: ["pad1", "pad2"],
      pcb_plated_hole_ids: ["hole1"],
    })
    expect(
      results.find(
        (result) =>
          result.type === "pcb_keepout_overlap_warning" &&
          result.pcb_via_ids?.includes("via1"),
      ),
    ).toBeDefined()
    for (const warning of results)
      expect(any_circuit_element.parse(warning)).toEqual(warning)
    expect(JSON.stringify(circuitJson)).toBe(before)
    const aggregate = await runAllPlacementChecks(circuitJson)
    expect(
      aggregate.filter(
        (result) => result.type === "pcb_keepout_overlap_warning",
      ),
    ).toEqual(
      results.filter((result) => result.type === "pcb_keepout_overlap_warning"),
    )
  })

  test(`${keepout.shape} false or omitted keeps existing errors, including alongside advisory regions`, () => {
    for (const warning_only of [false, undefined]) {
      const results = checkPcbCopperOverKeepout([
        ...copper,
        { ...keepout, warning_only },
        { ...keepout, pcb_keepout_id: "advisory", warning_only: true },
      ])
      expect(
        results.filter((result) => result.type === "pcb_placement_error"),
      ).toHaveLength(2)
      expect(
        results.filter(
          (result) => result.type === "pcb_keepout_overlap_warning",
        ),
      ).toHaveLength(2)
    }
  })

  test(`${keepout.shape} advisory component exclusions still suppress pad and plated-hole warnings`, () => {
    const results = checkPcbCopperOverKeepout([
      ...copper,
      {
        ...keepout,
        warning_only: true,
        excluded_pcb_component_ids: ["component1"],
      },
    ])
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      type: "pcb_keepout_overlap_warning",
      pcb_via_ids: ["via1"],
    })
  })

  test(`${keepout.shape} advisory trace overlaps warn once per trace/keepout across segments and aggregate runners`, async () => {
    const circuitJson: AnyCircuitElement[] = [
      structuredClone(trace),
      { ...keepout, warning_only: true },
    ]
    const results = checkEachPcbTraceNonOverlapping(circuitJson)
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      type: "pcb_keepout_overlap_warning",
      pcb_keepout_id: keepout.pcb_keepout_id,
      pcb_trace_ids: ["trace1"],
      subcircuit_id: "subcircuit1",
    })
    expect(any_circuit_element.parse(results[0])).toEqual(results[0])
    expect(
      (await runAllRoutingChecks(circuitJson)).filter(
        (result) => result.type === "pcb_keepout_overlap_warning",
      ),
    ).toEqual(
      results.filter((result) => result.type === "pcb_keepout_overlap_warning"),
    )
    expect(
      checkEachPcbTraceNonOverlapping([
        structuredClone(trace),
        { ...keepout, warning_only: true, layers: ["bottom"] },
      ]),
    ).toEqual([])
  })

  test(`${keepout.shape} normal keepouts and unrelated trace collisions still produce errors`, () => {
    for (const warning_only of [false, undefined]) {
      const results = checkEachPcbTraceNonOverlapping([
        structuredClone(trace),
        { ...keepout, warning_only },
        { ...keepout, pcb_keepout_id: "advisory", warning_only: true },
        {
          type: "pcb_smtpad",
          pcb_smtpad_id: "unrelated",
          shape: "circle",
          x: 0,
          y: 0,
          radius: 0.2,
          layer: "top",
        },
      ])
      expect(
        results.filter((result) => result.type === "pcb_trace_error"),
      ).toHaveLength(2)
      expect(
        results.filter(
          (result) => result.type === "pcb_keepout_overlap_warning",
        ),
      ).toHaveLength(1)
    }
  })
}
