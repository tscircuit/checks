import { expect, test } from "bun:test"
import type { PcbPlatedHole } from "circuit-json"
import { checkViasInPads } from "lib/check-vias-in-pads"
import {
  issueCornerPad,
  issueCornerVia,
  makeKnownNetCircuit,
  rectPad,
  viaInRectPad,
} from "./check-vias-in-pads-fixtures"

test.each([
  {
    overlap: "center overlap",
    pad: rectPad,
    via: viaInRectPad,
  },
  {
    overlap: "corner-only overlap",
    pad: issueCornerPad,
    via: issueCornerVia,
  },
  {
    overlap: "plated-hole center overlap",
    pad: {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "pcb_plated_hole_same_net",
      shape: "circle",
      x: 0,
      y: 0,
      outer_diameter: 1,
      hole_diameter: 0.5,
      layers: ["top", "bottom"],
    } as PcbPlatedHole,
    via: viaInRectPad,
  },
])("allows a same-net $overlap", ({ pad, via }) => {
  const circuitJson = makeKnownNetCircuit({
    pad,
    via,
    padNetId: "source_net_gnd",
    viaNetId: "source_net_gnd",
  })

  expect(checkViasInPads(circuitJson)).toEqual([])
})
