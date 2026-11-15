import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbTraceLengths } from "../.."

// Minimal generic copper tree: a--j--b, with an unrelated long j--c branch.
// No single route contains both a and b, so selecting exact endpoint routes
// cannot distinguish the intended path from the total length of the tree.
const circuit = (pathEnd: number): AnyCircuitElement[] =>
  [
    {
      type: "source_trace",
      source_trace_id: "t",
      connected_source_port_ids: ["a", "b"],
      connected_source_net_ids: [],
      max_length: 5,
    },
    ...["a", "b", "c"].map((id) => ({
      type: "pcb_port" as const,
      pcb_port_id: id,
      source_port_id: id,
      pcb_component_id: id,
      x: id === "b" ? pathEnd : 0,
      y: id === "c" ? 100 : 0,
      layers: ["top" as const],
    })),
    {
      type: "pcb_trace",
      pcb_trace_id: "a_j",
      source_trace_id: "t",
      route: [
        {
          route_type: "wire",
          x: 0,
          y: 0,
          layer: "top",
          width: 0.2,
          start_pcb_port_id: "a",
        },
        { route_type: "wire", x: 2, y: 0, layer: "top", width: 0.2 },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "j_b",
      source_trace_id: "t",
      route: [
        { route_type: "wire", x: 2, y: 0, layer: "top", width: 0.2 },
        {
          route_type: "wire",
          x: pathEnd,
          y: 0,
          layer: "top",
          width: 0.2,
          end_pcb_port_id: "b",
        },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "j_c",
      source_trace_id: "t",
      route: [
        { route_type: "wire", x: 2, y: 0, layer: "top", width: 0.2 },
        {
          route_type: "wire",
          x: 2,
          y: 100,
          layer: "top",
          width: 0.2,
          end_pcb_port_id: "c",
        },
      ],
    },
  ] as AnyCircuitElement[]

test("a short endpoint path does not inherit unrelated branch copper", () => {
  const input = circuit(4)
  const before = structuredClone(input)
  expect(checkPcbTraceLengths(input)).toEqual([])
  expect(input).toEqual(before)
})

test("the same endpoint path still reports its genuinely excessive length", () => {
  expect(checkPcbTraceLengths(circuit(7))).toEqual([
    expect.objectContaining({
      source_trace_id: "t",
      actual_trace_length: 7,
      maximum_trace_length: 5,
    }),
  ])
})
