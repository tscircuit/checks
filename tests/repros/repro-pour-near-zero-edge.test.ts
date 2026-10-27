import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkEachPcbPortConnectedToPcbTraces } from "lib/check-each-pcb-port-connected-to-pcb-trace"

// Saved-board geometry; a native TSX crash reproduction remains unestablished.
// Keep snapshot assertions outside test.failing so visual failures remain failures.
const circuit: AnyCircuitElement[] = [
  {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "pour",
    layer: "bottom",
    shape: "brep",
    covered_with_solder_mask: false,
    brep_shape: {
      outer_ring: {
        vertices: [
          { x: 0, y: -10 },
          { x: 5, y: -10 },
          { x: 5, y: 0 },
          { x: 0, y: 0 },
        ],
      },
      inner_rings: [
        {
          vertices: [
            { x: 2.0060000000000024, y: -7.0489999999999995 },
            { x: 2.0060000000000024, y: -7.048999999999997 },
            { x: 2.005559999870567, y: -7.040043591610283 },
            { x: 3, y: -7 },
          ],
        },
      ],
    },
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "trace",
    route: [
      {
        route_type: "wire",
        layer: "bottom",
        width: 0.1,
        x: 1.8510000000000026,
        y: -7.0489999999999995,
      },
      {
        route_type: "wire",
        layer: "bottom",
        width: 0.1,
        x: 1.8510000000000026,
        y: -7.999000000000002,
      },
    ],
  },
]

test("near-zero pour cutout edge visual context", async () => {
  for (const [name, viewport] of [
    [
      "pour-near-zero-edge-overview",
      { minX: -0.5, maxX: 5.5, minY: -10.5, maxY: 0.5 },
    ],
    [
      "pour-near-zero-edge-cutout-detail",
      { minX: 1.65, maxX: 3.1, minY: -8.1, maxY: -6.85 },
    ],
  ] as const) {
    await expect(
      convertCircuitJsonToPcbSvg(circuit, {
        width: 900,
        height: 700,
        layer: "bottom",
        xRayElementIds: ["trace"],
        backgroundColor: "white",
        viewport,
        includeVersion: false,
      }),
    ).toMatchSvgSnapshot(import.meta.path, name)
  }
})

test.failing(
  "required-port checking handles a pour with near-zero cutout edges",
  () => {
    expect(checkEachPcbPortConnectedToPcbTraces(circuit)).toEqual([])
  },
)
