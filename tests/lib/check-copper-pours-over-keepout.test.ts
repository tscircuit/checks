import { expect, test } from "bun:test"
import {
  any_circuit_element,
  type AnyCircuitElement,
  type PCBKeepout,
  type PcbCopperPour,
} from "circuit-json"
import { checkCopperPoursOverKeepout, runAllRoutingChecks } from "../.."

const square = (radius: number) => [
  { x: -radius, y: -radius },
  { x: radius, y: -radius },
  { x: radius, y: radius },
  { x: -radius, y: radius },
]

const pour: PcbCopperPour = {
  type: "pcb_copper_pour",
  pcb_copper_pour_id: "ground_pour",
  covered_with_solder_mask: true,
  shape: "rect",
  center: { x: 0, y: 0 },
  width: 10,
  height: 10,
  layer: "top",
  source_net_id: "gnd",
  subcircuit_id: "rf_board",
}

const keepout: PCBKeepout = {
  type: "pcb_keepout",
  pcb_keepout_id: "antenna_keepout",
  shape: "rect",
  center: { x: 0, y: 0 },
  width: 2,
  height: 2,
  layers: ["top"],
  description: "Antenna copper-free region",
}

test("reports a finished copper pour overlapping a keepout", () => {
  const errors = checkCopperPoursOverKeepout([pour, keepout])
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_placement_error",
    pcb_placement_error_id:
      "copper_pour_over_keepout_ground_pour_antenna_keepout",
    subcircuit_id: "rf_board",
  })
  expect(errors[0].message).toContain("Antenna copper-free region")
  expect(any_circuit_element.safeParse(errors[0]).success).toBe(true)
})

test("respects layers and does not let trace or placement permissions admit pours", () => {
  expect(
    checkCopperPoursOverKeepout([
      pour,
      { ...keepout, layers: ["bottom"] },
    ]),
  ).toEqual([])

  expect(
    checkCopperPoursOverKeepout([
      pour,
      {
        ...keepout,
        allow_traces: true,
        allow_placements: true,
        excluded_pcb_component_ids: ["antenna_component"],
      },
    ]),
  ).toHaveLength(1)
})

test("advisory keepouts emit a schema-valid warning", () => {
  const errors = checkCopperPoursOverKeepout([
    pour,
    { ...keepout, warning_only: true },
  ])
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_keepout_overlap_warning",
    pcb_keepout_id: "antenna_keepout",
    subcircuit_id: "rf_board",
  })
  expect(any_circuit_element.safeParse(errors[0]).success).toBe(true)
})

test("respects BRep copper cutouts", () => {
  const cutoutPour: PcbCopperPour = {
    ...pour,
    shape: "brep",
    brep_shape: {
      outer_ring: { vertices: square(5) },
      inner_rings: [{ vertices: square(2) }],
    },
  }

  expect(checkCopperPoursOverKeepout([cutoutPour, keepout])).toEqual([])
  expect(
    checkCopperPoursOverKeepout([
      cutoutPour,
      { ...keepout, center: { x: 2, y: 0 } },
    ]),
  ).toHaveLength(1)
})

test("supports circle and outline keepout geometry", () => {
  const variants: PCBKeepout[] = [
    {
      ...keepout,
      shape: "circle",
      center: { x: 0, y: 0 },
      radius: 1,
    },
    {
      ...keepout,
      shape: "outline",
      outline: square(1),
      stroke_width: 0.1,
    },
  ]

  for (const variant of variants) {
    expect(checkCopperPoursOverKeepout([pour, variant])).toHaveLength(1)
  }
})

test("is included in the routing-check pass", async () => {
  const circuitJson: AnyCircuitElement[] = [pour, keepout]
  const errors = await runAllRoutingChecks(circuitJson)
  expect(
    errors.some(
      (error) =>
        error.type === "pcb_placement_error" &&
        error.pcb_placement_error_id ===
          "copper_pour_over_keepout_ground_pour_antenna_keepout",
    ),
  ).toBe(true)
})
