import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbVia } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkDifferentNetViaSpacing } from "lib/check-different-net-via-spacing"
import { runAllRoutingChecks } from "lib/run-all-checks"

test("reproduces overlapping different-net via pads missed by routing checks", async () => {
  const bootVia: PcbVia = {
    type: "pcb_via",
    pcb_via_id: "pcb_via_boot",
    pcb_trace_id: "pcb_trace_boot",
    x: 6.539759205507837,
    y: 4.785714942455886,
    hole_diameter: 0.3,
    outer_diameter: 0.6,
    layers: ["top", "inner1", "inner2"],
    from_layer: "top",
    to_layer: "inner2",
  }
  const psramVia: PcbVia = {
    type: "pcb_via",
    pcb_via_id: "pcb_via_psram",
    pcb_trace_id: "pcb_trace_psram",
    x: 6.19058496529081,
    y: 4.298298490400989,
    hole_diameter: 0.3,
    outer_diameter: 0.6,
    layers: ["top", "inner1"],
    from_layer: "inner1",
    to_layer: "top",
  }
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "pcb_board_1",
      center: { x: 6.35, y: 4.54 },
      width: 2,
      height: 2,
      thickness: 1.6,
      num_layers: 4,
      material: "fr4",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_boot",
      route: [],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "pcb_trace_psram",
      route: [],
    },
    bootVia,
    psramVia,
  ]

  const centerDistance = Math.hypot(
    bootVia.x - psramVia.x,
    bootVia.y - psramVia.y,
  )
  const copperGap =
    centerDistance - bootVia.outer_diameter / 2 - psramVia.outer_diameter / 2
  const drillGap =
    centerDistance - bootVia.hole_diameter / 2 - psramVia.hole_diameter / 2

  expect(copperGap).toBeLessThan(0)
  expect(drillGap).toBeGreaterThan(0)
  expect(checkDifferentNetViaSpacing(circuitJson)).toEqual([])
  const routingErrors = await runAllRoutingChecks(circuitJson)
  expect(routingErrors).toEqual([])

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...routingErrors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
