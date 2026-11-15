import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { checkPcbTraceLengths } from "../.."

// Board-world coordinates in mm: +X right, +Y up. Independent branches
// start at the capacitor pad; the remote branch does not touch that pad.
const branch = (
  id: string,
  startPort: string,
  endPort: string,
  length: number,
): PcbTrace => ({
  type: "pcb_trace",
  pcb_trace_id: id,
  source_trace_id: "capacitor_ground",
  route: [
    {
      route_type: "wire",
      x: 0,
      y: 0,
      width: 0.15,
      layer: "top",
      start_pcb_port_id: startPort,
    },
    {
      route_type: "wire",
      x: length,
      y: 0,
      width: 0.15,
      layer: "top",
      end_pcb_port_id: endPort,
    },
  ],
})

const source: AnyCircuitElement[] = [
  {
    type: "source_trace",
    source_trace_id: "capacitor_ground",
    connected_source_port_ids: ["capacitor_ground_port"],
    connected_source_net_ids: ["ground"],
    max_length: 1,
  },
  {
    type: "pcb_port",
    pcb_port_id: "capacitor_pad",
    source_port_id: "capacitor_ground_port",
    pcb_component_id: "capacitor",
    x: 0,
    y: 0,
    layers: ["top"],
  },
]

test("does not sum independent pin-to-net branches or include remote branches", () => {
  expect(
    checkPcbTraceLengths([
      ...source,
      branch("left", "capacitor_pad", "left_pad", 0.75),
      branch("right", "right_pad", "capacitor_pad", 0.75),
      branch("remote", "left_pad", "remote_pad", 20),
    ]),
  ).toEqual([])
})

test("reports each genuinely overlong incident branch using its own length", () => {
  expect(
    checkPcbTraceLengths([
      ...source,
      branch("short", "capacitor_pad", "left_pad", 0.75),
      branch("long", "right_pad", "capacitor_pad", 1.5),
      branch("longer", "capacitor_pad", "third_pad", 2),
      branch("remote", "left_pad", "remote_pad", 20),
    ]),
  ).toEqual([
    expect.objectContaining({ pcb_trace_id: "long", actual_trace_length: 1.5 }),
    expect.objectContaining({ pcb_trace_id: "longer", actual_trace_length: 2 }),
  ])
})

test("retains aggregation for pin-to-net routes without complete endpoint metadata", () => {
  const fragment = branch("fragment", "capacitor_pad", "left_pad", 0.75)
  const fragmentEnd = fragment.route[1]!
  if (fragmentEnd.route_type === "wire") delete fragmentEnd.end_pcb_port_id
  expect(
    checkPcbTraceLengths([
      ...source,
      fragment,
      branch("other_fragment", "left_pad", "right_pad", 0.75),
    ]),
  ).toEqual([
    expect.objectContaining({
      actual_trace_length: 1.5,
      maximum_trace_length: 1,
    }),
  ])
})
