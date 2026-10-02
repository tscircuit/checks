import { expect, test } from "bun:test"
import { bendZoneVisual } from "../fixtures/pcb-bend-zones-visual"

test("visualizes failing via, pad, backing and corner in a finite bend zone", () => {
  const { placement, routing, svg } = bendZoneVisual(false)
  expect(placement.map((error) => error.pcb_placement_error_id).sort()).toEqual(
    ["bend_zone_bend_BACKING", "bend_zone_bend_PAD", "bend_zone_bend_VIA"],
  )
  expect(routing.map((error) => error.pcb_trace_id)).toEqual(["SIGNAL"])
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
