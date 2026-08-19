import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { isPointInPad } from "lib/check-traces-are-contiguous/is-point-in-pad"

const circuitJson = [
  {
    type: "pcb_board",
    pcb_board_id: "pcb_board_0",
    center: { x: 2.637275, y: 1.574125 },
    width: 2.5,
    height: 2.5,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
  },
  {
    type: "source_trace",
    source_trace_id: "source_net_10",
    connected_source_port_ids: ["source_port_27", "source_port_28"],
    connected_source_net_ids: [],
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_27",
    source_port_id: "source_port_27",
    x: 2.637275000000003,
    y: 1.053424999999998,
    layers: ["bottom"],
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_28",
    source_port_id: "source_port_28",
    x: 2.6372750000000034,
    y: 2.0948249999999984,
    layers: ["bottom"],
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_27",
    pcb_port_id: "pcb_port_27",
    shape: "rect",
    x: 2.637275000000003,
    y: 1.053424999999998,
    width: 1.27,
    height: 0.6604,
    layer: "bottom",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_28",
    pcb_port_id: "pcb_port_28",
    shape: "rect",
    x: 2.6372750000000034,
    y: 2.0948249999999984,
    width: 1.27,
    height: 0.6604,
    layer: "bottom",
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_1",
    source_trace_id: "source_net_10",
    route: [
      {
        route_type: "wire",
        x: 2.637275000000003,
        y: 1.3836249999999986,
        width: 0.3175,
        layer: "bottom",
      },
      {
        route_type: "wire",
        x: 2.6372750000000034,
        y: 1.764624999999998,
        width: 0.3175,
        layer: "bottom",
      },
    ],
  },
] as AnyCircuitElement[]

test("reproduces a floating-point miss at a rectangular pad boundary", () => {
  const pad = circuitJson.find(
    (element) =>
      element.type === "pcb_smtpad" &&
      element.pcb_smtpad_id === "pcb_smtpad_27",
  )
  if (!pad || pad.type !== "pcb_smtpad") {
    throw new Error("Missing circuit018 boundary pad fixture")
  }

  expect(
    isPointInPad({ x: 2.637275000000003, y: 1.3836249999999986 }, pad),
  ).toBe(false)

  const errors = checkTracesAreContiguous(circuitJson)
  expect(errors).toHaveLength(2)
  expect(errors.map((error) => error.pcb_port_ids)).toEqual([
    ["pcb_port_27"],
    ["pcb_port_28"],
  ])
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path, "circuit018-pad-boundary")
})
