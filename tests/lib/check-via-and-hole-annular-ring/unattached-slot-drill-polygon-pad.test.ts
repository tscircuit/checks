import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbPlatedHole } from "circuit-json"
import { checkViaAndHoleAnnularRing } from "../../../lib/check-via-and-hole-annular-ring"

test("an unattached, unrotated slot drill in a polygon pad is measured", () => {
  // No `ccw_rotation` and no `pcb_component_id`: absent rotation means
  // axis-aligned under every consumer, not a reason to skip the measurement.
  const slottedPolygonPad = {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "plated_1",
    shape: "hole_with_polygon_pad",
    hole_shape: "pill",
    x: 0,
    y: 0,
    hole_width: 1,
    hole_height: 0.5,
    hole_offset_x: 0,
    hole_offset_y: 0,
    // 1.1 x 0.6mm rectangle around the 1 x 0.5mm slot leaves 0.05mm
    pad_outline: [
      { x: -0.55, y: -0.3 },
      { x: 0.55, y: -0.3 },
      { x: 0.55, y: 0.3 },
      { x: -0.55, y: 0.3 },
    ],
    ccw_rotation: 0,
    layers: ["top", "bottom"],
  } satisfies PcbPlatedHole
  const { ccw_rotation: _rotation, ...unrotated } = slottedPolygonPad
  const circuitJson: AnyCircuitElement[] = [unrotated as AnyCircuitElement]

  const errors = checkViaAndHoleAnnularRing(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0]!.message).toContain(
    "annular ring 0.05mm is below the minimum of 0.13mm",
  )
})
