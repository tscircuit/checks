import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { getPourContactTester } from "../../lib/check-traces-are-contiguous/pour-contact-index"

test("pour contact preserves the via drill hole and handles point-only vias", () => {
  const circuit: AnyCircuitElement[] = [
    {
      type: "source_trace",
      source_trace_id: "trace",
      connected_source_port_ids: [],
      connected_source_net_ids: ["net"],
    },
    {
      type: "pcb_copper_pour",
      pcb_copper_pour_id: "pour",
      source_net_id: "net",
      shape: "brep",
      layer: "top",
      covered_with_solder_mask: true,
      brep_shape: {
        outer_ring: {
          vertices: [
            { x: -0.01, y: -0.01 },
            { x: 0.01, y: -0.01 },
            { x: 0.01, y: 0.01 },
            { x: -0.01, y: 0.01 },
          ],
        },
        inner_rings: [],
      },
    },
  ]
  const connectivity = getFullConnectivityMapFromCircuitJson(circuit)
  const net = connectivity.getNetConnectedToId("net")!
  const touchesPour = getPourContactTester(circuit, connectivity)
  expect(touchesPour(net, ["top"], { x: 0, y: 0 }, 0.2, 0.1)).toBe(false)
  expect(touchesPour(net, ["top"], { x: 0, y: 0 }, 0.2)).toBe(true)
  expect(touchesPour(net, ["top"], { x: 0, y: 0 }, 0)).toBe(true)
  expect(touchesPour(net, ["top"], { x: 0.03, y: 0 }, 0)).toBe(false)
})
