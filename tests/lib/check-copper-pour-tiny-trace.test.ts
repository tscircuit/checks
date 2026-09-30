import { expect, test } from "bun:test"
import { any_circuit_element } from "circuit-json"
import { checkCopperPourShorts } from "../../index"
import { trace } from "../fixtures/tiny-trace-near-drill"

const pour = (radius: number) =>
  any_circuit_element.parse({
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "ground_pour",
    shape: "brep",
    layer: "bottom",
    source_net_id: "ground",
    brep_shape: {
      outer_ring: {
        vertices: [
          { x: -5.125 - radius, y: 0.923 - radius },
          { x: -5.125 + radius, y: 0.923 - radius },
          { x: -5.125 + radius, y: 0.923 + radius },
          { x: -5.125 - radius, y: 0.923 + radius },
        ],
      },
      inner_rings: [],
    },
  })

test("tiny trace near a via drill does not crash or hide copper-pour shorts", () => {
  const signalTrace = { ...trace, source_trace_id: "signal" }
  // Copper wholly inside the drilled void must remain isolated.
  expect(checkCopperPourShorts([signalTrace, pour(0.02)])).toEqual([])
  // A larger pour touches the annular copper and must still report the short.
  const errors = checkCopperPourShorts([signalTrace, pour(0.3)])
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_placement_error_id).toBe(
    "copper_pour_short_ground_pour_tiny_segment_near_drill",
  )
})
