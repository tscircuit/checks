import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPadPadClearance } from "../../lib/check-pad-pad-clearance"

// The local upper-right corner arc is centered at (0.5, 0.5).
// Gap = sqrt(2) * (d - 0.5) - 0.5 - 0.1:
// d=1.3 gives 0.53137 mm (legal); d=1.2 gives 0.38995 mm (violation).
// Ignoring corner_radius incorrectly gives 0.32426 mm at d=1.3.
const point = (x: number, y: number) => {
  const angle = (37 * Math.PI) / 180
  return {
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  }
}

const pad = (cornerRadius: number): AnyCircuitElement => ({
  type: "pcb_smtpad",
  pcb_smtpad_id: "rounded_pad",
  shape: "rotated_rect",
  x: 0,
  y: 0,
  width: 2,
  height: 2,
  corner_radius: cornerRadius,
  ccw_rotation: 37,
  layer: "top",
})

const obstacle = (d: number): AnyCircuitElement => ({
  type: "pcb_smtpad",
  pcb_smtpad_id: "other_pad",
  shape: "circle",
  ...point(d, d),
  radius: 0.1,
  layer: "top",
})

const errors = (cornerRadius: number, d: number) =>
  checkPadPadClearance([pad(cornerRadius), obstacle(d)], { minClearance: 0.5 })

test("snapshots pad-to-pad rounded-corner clearance at 37 degrees", () => {
  // Show physical copper, without recording incorrect DRC markers as a baseline.
  const svg = convertCircuitJsonToPcbSvg([pad(0.5), obstacle(1.3)], {
    width: 500,
    height: 500,
    layer: "top",
  })
  expect(svg).toMatchSvgSnapshot(
    import.meta.path,
    "pad-to-pad-rounded-corner-37deg",
  )
})

test("accepts the legal pad-to-pad gap at 37 degrees", () => {
  expect(errors(0.5, 1.3)).toHaveLength(0)
})

test("rejects a closer obstacle at 37 degrees", () => {
  expect(errors(0.5, 1.2)).toHaveLength(1)
})

test("rejects the sharp-corner pad-to-pad gap at 37 degrees", () => {
  expect(errors(0, 1.3)).toHaveLength(1)
})
