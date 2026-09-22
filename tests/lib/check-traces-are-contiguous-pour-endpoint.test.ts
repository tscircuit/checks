import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbCopperPour } from "circuit-json"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"

const pour = {
  type: "pcb_copper_pour",
  pcb_copper_pour_id: "pour",
  source_net_id: "net",
  shape: "brep",
  layer: "top",
  covered_with_solder_mask: true,
  brep_shape: {
    outer_ring: {
      vertices: [
        { x: -0.5, y: -1 },
        { x: 1, y: -1 },
        { x: 1, y: 1 },
        { x: -0.5, y: 1 },
      ],
    },
    inner_rings: [],
  },
} satisfies PcbCopperPour

function endpointErrors(copperPour: PcbCopperPour) {
  const circuit: AnyCircuitElement[] = [
    {
      type: "source_trace",
      source_trace_id: "source_trace",
      connected_source_port_ids: [],
      connected_source_net_ids: ["net"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace",
      source_trace_id: "source_trace",
      route: [
        { route_type: "wire", x: -2, y: 0, width: 0.2, layer: "top" },
        { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
      ],
    },
    copperPour,
  ]
  return checkTracesAreContiguous(circuit).map(
    (error) => error.pcb_trace_error_id,
  )
}
test("requires actual same-net same-layer pour copper at an endpoint", () => {
  // same-layer same-net pour copper terminates a trace
  expect(endpointErrors(pour)).not.toContain("disconnected_endpoint_trace_end")
  // another layer or another net cannot terminate a trace
  expect(endpointErrors({ ...pour, layer: "bottom" })).toContain(
    "disconnected_endpoint_trace_end",
  )
  expect(endpointErrors({ ...pour, source_net_id: "other" })).toContain(
    "disconnected_endpoint_trace_end",
  )
  // a pour hole containing the complete endpoint copper remains disconnected
  const withHole: PcbCopperPour = structuredClone(pour)
  withHole.brep_shape.inner_rings.push({
    vertices: [
      { x: -0.2, y: -0.2 },
      { x: -0.2, y: 0.2 },
      { x: 0.2, y: 0.2 },
      { x: 0.2, y: -0.2 },
    ],
  })
  expect(endpointErrors(withHole)).toContain("disconnected_endpoint_trace_end")
})
