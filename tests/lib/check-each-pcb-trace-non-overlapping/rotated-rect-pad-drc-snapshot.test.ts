import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"

test("rotated rectangular pad trace crossing renders DRC error", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: -3.5, y: 0.6 },
      width: 5,
      height: 3,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace1",
      route: [
        { route_type: "wire", x: -5, y: 1.084, width: 0.08, layer: "top" },
        { route_type: "wire", x: -2, y: 1.084, width: 0.08, layer: "top" },
      ],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      shape: "rotated_rect",
      x: -3.6,
      y: 0.2,
      width: 3.1,
      height: 0.8,
      ccw_rotation: 45,
      layer: "top",
    },
  ]

  const errors = checkEachPcbTraceNonOverlapping(circuitJson, {
    minClearance: 0,
  })

  expect(errors).toHaveLength(1)
  expect(errors[0]!.center).toBeDefined()

  const svg = convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
    shouldDrawErrors: true,
  })

  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
