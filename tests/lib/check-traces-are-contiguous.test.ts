import { expect, test, describe } from "bun:test"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"
import circuitJson from "tests/assets/traces-with-vias-2.json"
import corruptedCircuitJson from "tests/assets/traces-with-vias-corrupted.json"
import repro02 from "tests/assets/motor-controller-1.json"
import type { AnyCircuitElement } from "circuit-json"
import { runAllRoutingChecks } from "lib/run-all-checks"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"

describe("testing checkTracesAreContiguous(", () => {
  test("should not error as traces are contiguous", () => {
    const errors = checkTracesAreContiguous(circuitJson as any)
    expect(errors).toHaveLength(0)
  })
  test("should error as a trace is not fully contiguous", () => {
    const errors = checkTracesAreContiguous(corruptedCircuitJson as any)
    expect(errors[0].message).toMatchInlineSnapshot(
      `"Via in trace [trace[source_trace_0_0]] is misaligned at position {x: -1.875, y: 1.875}."`,
    )
    expect(errors[1].message).toMatchInlineSnapshot(
      `"Trace [trace[source_trace_0_0]] is missing a connection to smtpad[.C1 > .anode]"`,
    )
  })
})

test("does not report missing connection for ports with multiple smtpads including polygon pads", () => {
  const circuitJson = [
    {
      type: "pcb_board",
      pcb_board_id: "pcb_board_0",
      center: { x: 0, y: -12 },
      width: 24,
      height: 40,
      material: "fr4",
      thickness: 1.6,
      num_layers: 2,
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_anchor",
      connected_source_port_ids: ["source_port_anchor", "source_port_probe"],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_polygon",
      connected_source_port_ids: ["source_port_polygon", "source_port_probe"],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_polygon_edge",
      connected_source_port_ids: [
        "source_port_polygon_edge",
        "source_port_probe",
      ],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_anchor",
      source_port_id: "source_port_anchor",
      x: -10,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_polygon",
      source_port_id: "source_port_polygon",
      x: -10,
      y: 2,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_polygon_edge",
      source_port_id: "source_port_polygon_edge",
      x: -10,
      y: 4,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: "pcb_port_probe",
      source_port_id: "source_port_probe",
      x: 0,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_anchor_source",
      pcb_port_id: "pcb_port_anchor",
      shape: "rect",
      x: -10,
      y: 0,
      width: 2,
      height: 2,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_polygon_source",
      pcb_port_id: "pcb_port_polygon",
      shape: "rect",
      x: -10,
      y: 2,
      width: 2,
      height: 2,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_polygon_edge_source",
      pcb_port_id: "pcb_port_polygon_edge",
      shape: "rect",
      x: -10,
      y: 4,
      width: 2,
      height: 2,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_probe_anchor",
      pcb_port_id: "pcb_port_probe",
      shape: "rect",
      x: 0,
      y: -5,
      width: 2,
      height: 2,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pcb_smtpad_probe_polygon",
      pcb_port_id: "pcb_port_probe",
      shape: "polygon",
      points: [
        { x: -8, y: 5 },
        { x: 8, y: 5 },
        { x: 8, y: -24 },
        { x: 1, y: -36 },
        { x: -1, y: -36 },
        { x: -8, y: -24 },
      ],
      layer: "top",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_anchor",
      source_trace_id: "source_trace_anchor",
      route: [
        { route_type: "wire", x: -10, y: 0, layer: "top", width: 0.2 },
        { route_type: "wire", x: 0, y: -5, layer: "top", width: 0.2 },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_polygon",
      source_trace_id: "source_trace_polygon",
      route: [
        { route_type: "wire", x: -10, y: 2, layer: "top", width: 0.2 },
        { route_type: "wire", x: 0, y: 0, layer: "top", width: 0.2 },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_polygon_edge",
      source_trace_id: "source_trace_polygon_edge",
      route: [
        { route_type: "wire", x: -10, y: 4, layer: "top", width: 0.2 },
        { route_type: "wire", x: 0, y: 5, layer: "top", width: 0.2 },
      ],
    },
  ] as AnyCircuitElement[]

  const errors = checkTracesAreContiguous(circuitJson)
  expect(errors).toHaveLength(0)

  expect(convertCircuitJsonToPcbSvg(circuitJson)).toMatchSvgSnapshot(
    import.meta.path,
  )
})

test("repro02 should report the J_VMOTOR GND trace disconnected endpoint", async () => {
  const circuitJson = repro02 as AnyCircuitElement[]
  const routingIssues = await runAllRoutingChecks(circuitJson)

  expect(routingIssues).toContainEqual(
    expect.objectContaining({
      type: "pcb_trace_error",
      pcb_trace_id: "source_net_0_mst2_0",
      pcb_trace_error_id: "disconnected_endpoint_source_net_0_mst2_0_end",
      message:
        "Trace [trace[.J_VMOTOR > port.pin2]] has disconnected endpoint at (22.03, -10.22)",
    }),
  )
})
