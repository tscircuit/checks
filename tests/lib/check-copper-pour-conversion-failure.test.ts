import { expect, test } from "bun:test"
import { pcb_placement_error, type AnyCircuitElement } from "circuit-json"
import { checkCopperPourShorts } from "lib/check-copper-pour-shorts"

test("via-adjacent short trace segments produce a fatal diagnostic when copper conversion fails", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_copper_pour",
      pcb_copper_pour_id: "pour",
      shape: "rect",
      center: { x: 0, y: 0 },
      width: 80,
      height: 64,
      layer: "bottom",
      covered_with_solder_mask: true,
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace",
      source_trace_id: "source_trace",
      route: [
        {
          route_type: "via",
          x: 22.416,
          y: 12.212,
          from_layer: "top",
          to_layer: "bottom",
          outer_diameter: 0.3,
          hole_diameter: 0.2,
        },
        {
          route_type: "wire",
          x: 22.416,
          y: 12.212,
          width: 0.2,
          layer: "bottom",
        },
        {
          route_type: "wire",
          x: 22.415758717732803,
          y: 12.211758717732803,
          width: 0.2,
          layer: "bottom",
        },
        {
          route_type: "wire",
          x: 22.414865888202357,
          y: 12.210865888202354,
          width: 0.2,
          layer: "bottom",
        },
      ],
    },
  ]

  const errors = checkCopperPourShorts(circuitJson)
  expect(errors).toHaveLength(1)
  expect(pcb_placement_error.parse(errors[0])).toMatchObject({
    type: "pcb_placement_error",
    is_fatal: true,
    message: expect.stringContaining("Cannot check copper pour shorts: trace:"),
  })
})
