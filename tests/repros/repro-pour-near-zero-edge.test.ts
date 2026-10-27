import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkEachPcbPortConnectedToPcbTraces } from "lib/check-each-pcb-port-connected-to-pcb-trace"

// Reduced from a routed board: the pour's cutout contains near-identical
// vertices where a trace endpoint's horizontal ray crosses its boundary.
test.failing(
  "required-port checking handles a pour with near-zero cutout edges",
  () => {
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
    expect(checkEachPcbPortConnectedToPcbTraces(circuit)).toEqual([])
  },
)
