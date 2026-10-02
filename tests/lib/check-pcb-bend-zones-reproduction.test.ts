import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import {
  board,
  bend,
  via,
  pad,
  stiffener,
  trace,
  placementIds,
  traceIds,
} from "../fixtures/pcb-bend-zones"
import {
  runAllChecks,
  runAllPlacementChecks,
  runAllRoutingChecks,
} from "lib/run-all-checks"

test("reports the flex-board reproduction through placement, routing and all checks", async () => {
  const circuit: AnyCircuitElement[] = [
    board,
    bend,
    via("via", 0, 4),
    stiffener,
    trace("corner", [
      [-5, 0],
      [0, 0],
      [0, 3],
    ]),
    pad("pad", 0, -4),
    {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "plated",
      shape: "circle",
      x: 0,
      y: -2,
      outer_diameter: 0.5,
      hole_diameter: 0.2,
      layers: ["top", "bottom"],
    },
  ]
  expect(placementIds(circuit).sort()).toEqual([
    "bend_zone_bend_pad",
    "bend_zone_bend_plated",
    "bend_zone_bend_stiffener",
    "bend_zone_bend_via",
  ])
  expect(traceIds(circuit)).toEqual(["corner"])
  const placement = await runAllPlacementChecks(circuit)
  const routing = await runAllRoutingChecks(circuit)
  const all = await runAllChecks(circuit)
  expect(
    placement.filter(
      (error) =>
        "pcb_placement_error_id" in error &&
        error.pcb_placement_error_id.startsWith("bend_zone_"),
    ),
  ).toHaveLength(4)
  expect(
    routing.filter(
      (error) =>
        "pcb_trace_error_id" in error &&
        error.pcb_trace_error_id.startsWith("bend_zone_"),
    ),
  ).toHaveLength(1)
  expect(
    all.filter((error) => error.message.includes("PCB bend zone")),
  ).toHaveLength(5)
})
