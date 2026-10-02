import { expect, test } from "bun:test"
import type { PcbTrace } from "circuit-json"
import {
  board,
  bend,
  via,
  trace,
  placementIds,
  traceIds,
} from "../fixtures/pcb-bend-zones"
import { runAllPlacementChecks } from "lib/run-all-checks"

test("reports route-only vias and deduplicates their materialized physical records", async () => {
  const routeOnly: PcbTrace = {
    ...trace("route_only", []),
    route: [
      { route_type: "wire", x: -5, y: 0, layer: "top", width: 0.1 },
      {
        route_type: "via",
        x: 0,
        y: 0,
        from_layer: "top",
        to_layer: "bottom",
        outer_diameter: 0.5,
        hole_diameter: 0.2,
      },
      { route_type: "wire", x: 5, y: 0, layer: "bottom", width: 0.1 },
    ],
  }
  expect(traceIds([board, bend, routeOnly])).toEqual([])
  expect(placementIds([board, bend, routeOnly])).toEqual([
    "bend_zone_bend_route_only_route_via_1",
  ])
  expect(
    placementIds([board, bend, routeOnly, via("materialized", 0, 0)]),
  ).toEqual(["bend_zone_bend_materialized"])
  const placement = await runAllPlacementChecks([board, bend, routeOnly])
  expect(
    placement.filter((error) => error.message.includes("PCB bend zone")),
  ).toHaveLength(1)
})
