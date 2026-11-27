import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbCopperPour } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"

const board: AnyCircuitElement[] = [
  {
    type: "pcb_board",
    pcb_board_id: "pcb_board_1",
    center: { x: 0, y: 0 },
    width: 12,
    height: 6,
    thickness: 1.6,
    material: "fr4",
    num_layers: 2,
  },
  {
    type: "source_net",
    source_net_id: "source_net_gnd",
    name: "GND",
    member_source_group_ids: [],
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_1",
    source_port_id: "source_port_1",
    x: -4,
    y: 0,
    layers: ["top"],
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_1",
    pcb_port_id: "pcb_port_1",
    shape: "rect",
    x: -4,
    y: 0,
    width: 1,
    height: 1,
    layer: "top",
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_gnd",
    source_trace_id: "source_net_gnd",
    route: [
      {
        route_type: "wire",
        x: -4,
        y: 0,
        width: 0.3,
        layer: "top",
        start_pcb_port_id: "pcb_port_1",
      },
      { route_type: "wire", x: 2, y: 0, width: 0.3, layer: "top" },
    ],
  },
]

const pour: PcbCopperPour = {
  type: "pcb_copper_pour",
  pcb_copper_pour_id: "pcb_copper_pour_gnd",
  source_net_id: "source_net_gnd",
  shape: "rect",
  center: { x: 3, y: 0 },
  width: 4,
  height: 4,
  layer: "top",
  covered_with_solder_mask: true,
}

test("net-level trace ending in a ground pour", () => {
  const circuit = [...board, pour]
  const errors = checkTracesAreContiguous(circuit)
  expect(errors).toHaveLength(1)
  expect(errors[0]?.center).toEqual({ x: 2, y: 0 })
  expect(
    convertCircuitJsonToPcbSvg([...circuit, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
