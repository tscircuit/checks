import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbBoard, PcbVia } from "circuit-json"
import { checkViaDimensions } from "../../lib/check-via-dimensions"

const board = (props: Partial<PcbBoard> = {}): PcbBoard => ({
  type: "pcb_board",
  pcb_board_id: "board1",
  center: { x: 0, y: 0 },
  width: 20,
  height: 10,
  thickness: 1.6,
  num_layers: 2,
  material: "fr4",
  ...props,
})

const via = (
  pcb_via_id: string,
  hole_diameter: number,
  outer_diameter: number,
  props: Partial<PcbVia> = {},
): PcbVia => ({
  type: "pcb_via",
  pcb_via_id,
  x: 0,
  y: 0,
  hole_diameter,
  outer_diameter,
  layers: ["top", "bottom"],
  from_layer: "top",
  to_layer: "bottom",
  ...props,
})

test("checkViaDimensions reports vias below the board's via minimums", () => {
  const circuitJson: AnyCircuitElement[] = [
    board({ min_via_hole_diameter: 0.3, min_via_pad_diameter: 0.6 }),
    via("via_default_size", 0.2, 0.3, { x: 2 }),
    via("via_ok", 0.3, 0.6, { x: 4 }),
  ]

  const errors = checkViaDimensions(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_via_clearance_error",
    error_type: "pcb_via_clearance_error",
    pcb_via_ids: ["via_default_size"],
    pcb_center: { x: 2, y: 0 },
  })
  expect(errors[0].message).toContain(
    "drill 0.2mm is below the minimum via drill of 0.3mm",
  )
  expect(errors[0].message).toContain(
    "pad 0.3mm is below the minimum via pad of 0.6mm",
  )
  // The ring itself (0.05mm) meets the default minimum, so no clearance values
  expect(errors[0].minimum_clearance).toBeUndefined()
})

test("checkViaDimensions reports a thin annular ring (issue #5559 case)", () => {
  // <via holeDiameter="0.3mm" outerDiameter="0.35mm" /> leaves a 0.025mm ring
  const circuitJson: AnyCircuitElement[] = [
    board({ min_via_hole_diameter: 0.3, min_via_pad_diameter: 0.6 }),
    via("thin_ring", 0.3, 0.35),
  ]

  const [error] = checkViaDimensions(circuitJson)

  expect(error.message).toContain("pad 0.35mm is below the minimum via pad")
  expect(error.message).toContain("annular ring 0.025mm is below the minimum")
  expect(error.message).not.toContain("drill 0.3mm")
  expect(error.minimum_clearance).toBeCloseTo(0.05, 10)
  expect(error.actual_clearance).toBeCloseTo(0.025, 10)
})

test("checkViaDimensions reports vias whose drill is not smaller than the pad", () => {
  const [error] = checkViaDimensions([board(), via("no_ring", 0.4, 0.4)])

  expect(error.message).toContain("leaving no annular ring")
  expect(error.actual_clearance).toBe(0)
})

test("checkViaDimensions falls back to JLCPCB minimums without board rules", () => {
  const errors = checkViaDimensions([
    via("jlc_ok", 0.2, 0.3),
    via("jlc_small_drill", 0.15, 0.3, { x: 2 }),
  ])

  expect(errors.map((error) => error.pcb_via_ids[0])).toEqual([
    "jlc_small_drill",
  ])
})

test("checkViaDimensions uses the rules of the board that owns each via", () => {
  const circuitJson: AnyCircuitElement[] = [
    board({
      pcb_board_id: "strict_board",
      subcircuit_id: "subcircuit_strict",
      min_via_hole_diameter: 0.3,
      min_via_pad_diameter: 0.6,
    }),
    board({
      pcb_board_id: "lenient_board",
      subcircuit_id: "subcircuit_lenient",
      center: { x: 30, y: 0 },
      min_via_hole_diameter: 0.2,
      min_via_pad_diameter: 0.3,
    }),
    via("strict_via", 0.2, 0.3, { subcircuit_id: "subcircuit_strict" }),
    via("lenient_via", 0.2, 0.3, {
      x: 30,
      subcircuit_id: "subcircuit_lenient",
    }),
  ]

  const errors = checkViaDimensions(circuitJson)

  expect(errors.map((error) => error.pcb_via_ids[0])).toEqual(["strict_via"])
  expect(errors[0].subcircuit_id).toBe("subcircuit_strict")
})

test("checkViaDimensions options override board and default minimums", () => {
  const circuitJson: AnyCircuitElement[] = [
    board({ min_via_hole_diameter: 0.3, min_via_pad_diameter: 0.6 }),
    via("via", 0.3, 0.6),
  ]

  expect(checkViaDimensions(circuitJson)).toHaveLength(0)
  const [error] = checkViaDimensions(circuitJson, { minViaAnnularRing: 0.2 })
  expect(error.message).toContain(
    "annular ring 0.15mm is below the minimum of 0.2mm",
  )
  expect(
    checkViaDimensions(circuitJson, {
      minViaHoleDiameter: 0.2,
      minViaPadDiameter: 0.3,
      minViaAnnularRing: 0.1,
    }),
  ).toHaveLength(0)
})
