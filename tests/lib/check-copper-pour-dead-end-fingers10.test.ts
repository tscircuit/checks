import { expect, test } from "bun:test"
import { net, pour, check } from "../fixtures/copper-pour-dead-end-fingers"

test("resolves pad and trace connections through the logical net map", () => {
  const sourceTrace = {
    type: "source_trace",
    source_trace_id: "source_trace_1",
    connected_source_port_ids: ["source_port_1"],
    connected_source_net_ids: [net.source_net_id],
  }
  const port = {
    type: "pcb_port",
    pcb_port_id: "pcb_port_1",
    source_port_id: "source_port_1",
  }
  const pad = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_1",
    pcb_port_id: port.pcb_port_id,
    shape: "rect",
    x: 9.5,
    y: 2.5,
    width: 0.5,
    height: 0.5,
    layer: "top",
  }
  expect(check(pour(), pad, port, sourceTrace)).toEqual([])
  expect(check(pour(), pad)).toHaveLength(1)
  const trace = {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_1",
    source_trace_id: sourceTrace.source_trace_id,
    route: [2.5, 4].map((y) => ({
      route_type: "wire",
      x: 9.5,
      y,
      width: 0.2,
      layer: "top",
    })),
  }
  expect(check(pour(), trace, sourceTrace)).toEqual([])
  expect(
    check(pour(), { ...pad, layer: "bottom" }, port, sourceTrace),
  ).toHaveLength(1)
  expect(check(pour(), { ...pad, x: 5 }, port, sourceTrace)).toHaveLength(1)
  expect(
    check(
      pour(),
      {
        type: "pcb_plated_hole",
        pcb_plated_hole_id: "pcb_plated_hole_1",
        pcb_port_id: port.pcb_port_id,
        shape: "circle",
        x: 9.5,
        y: 2.5,
        outer_diameter: 0.6,
        hole_diameter: 0.3,
        layers: ["top", "bottom"],
      },
      port,
      sourceTrace,
    ),
  ).toEqual([])
})
