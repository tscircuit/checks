import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPadPadClearance } from "../../lib/check-pad-pad-clearance"
import { checkPadTraceClearance } from "../../lib/check-pad-trace-clearance"
import { checkViaPadClearance } from "../../lib/check-via-pad-clearance"

// A 2 x 2 mm pad with 0.5 mm corner radius has its upper-right arc
// centered at (0.5, 0.5). With 0.1 mm obstacle radius, a diagonal
// obstacle at (d, d) has gap sqrt(2) * (d - 0.5) - 0.5 - 0.1.
// d=1.3 => 0.53137 mm (legal); d=1.2 => 0.38995 mm (violation).
// Ignoring corner_radius instead reports 0.32426 mm at d=1.3.
const minimumClearance = 0.5

for (const rotation of [0, 37]) {
  const point = (x: number, y: number) => {
    const angle = (rotation * Math.PI) / 180
    return {
      x: x * Math.cos(angle) - y * Math.sin(angle),
      y: x * Math.sin(angle) + y * Math.cos(angle),
    }
  }
  const pad = (cornerRadius: number): AnyCircuitElement => ({
    type: "pcb_smtpad",
    pcb_smtpad_id: "rounded_pad",
    shape: rotation === 0 ? "rect" : "rotated_rect",
    x: 0,
    y: 0,
    width: 2,
    height: 2,
    corner_radius: cornerRadius,
    ccw_rotation: rotation,
    layer: "top",
  })
  const cases = [
    {
      name: "pad-to-trace",
      check: checkPadTraceClearance,
      obstacle: (d: number): AnyCircuitElement => ({
        type: "pcb_trace",
        pcb_trace_id: "other_trace",
        route: [
          { route_type: "wire", ...point(d, d), width: 0.2, layer: "top" },
          { route_type: "wire", ...point(2, d), width: 0.2, layer: "top" },
        ],
      }),
    },
    {
      name: "pad-to-pad",
      check: checkPadPadClearance,
      obstacle: (d: number): AnyCircuitElement => ({
        type: "pcb_smtpad",
        pcb_smtpad_id: "other_pad",
        shape: "circle",
        ...point(d, d),
        radius: 0.1,
        layer: "top",
      }),
    },
    {
      name: "via-to-pad",
      check: checkViaPadClearance,
      obstacle: (d: number): AnyCircuitElement => ({
        type: "pcb_via",
        pcb_via_id: "other_via",
        ...point(d, d),
        outer_diameter: 0.2,
        hole_diameter: 0.1,
        layers: ["top", "bottom"],
      }),
    },
  ]

  for (const { name, check, obstacle } of cases) {
    describe(`${name}, pad rotation ${rotation} degrees`, () => {
      const errors = (cornerRadius: number, d: number) =>
        check([pad(cornerRadius), obstacle(d)], {
          minClearance: minimumClearance,
        })

      test("snapshots the legal rounded-corner clearance fixture", () => {
        // Snapshot the physical geometry without baking the erroneous DRC result
        // into the visual baseline. The assertion below reproduces that error.
        const svg = convertCircuitJsonToPcbSvg([pad(0.5), obstacle(1.3)], {
          width: 500,
          height: 500,
        })
        expect(svg).toMatchSvgSnapshot(
          import.meta.path,
          `${name}-rounded-corner-${rotation}deg`,
        )
      })

      test("does not flag a legal gap beside the rounded corner", () => {
        expect(errors(0.5, 1.3)).toHaveLength(0)
      })

      test("still flags a closer obstacle and a sharp-corner pad", () => {
        expect(errors(0.5, 1.2)).toHaveLength(1)
        expect(errors(0, 1.3)).toHaveLength(1)
      })
    })
  }
}
