import { expect, test } from "bun:test"
import type { PcbPlatedHole } from "circuit-json"
import { checkViasInPads } from "lib/check-vias-in-pads"
import {
  issueCornerPad,
  issueCornerVia,
  makeBoard,
  makeKnownNetCircuit,
  rectPad,
  viaInRectPad,
} from "./check-vias-in-pads-fixtures"

test.each([
  {
    overlap: "center overlap",
    pad: rectPad,
    via: viaInRectPad,
    expectedErrors: 1,
  },
  {
    overlap: "drill crossing the pad edge",
    pad: rectPad,
    via: { ...viaInRectPad, x: 0.55, y: 0 },
    expectedErrors: 1,
  },
  {
    overlap: "nearby via without overlap",
    pad: rectPad,
    via: { ...viaInRectPad, x: 1, y: 0 },
    expectedErrors: 0,
  },
  {
    overlap: "corner-only overlap",
    pad: issueCornerPad,
    via: issueCornerVia,
    expectedErrors: 0,
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
    expectedErrors: 1,
  },
])("checks a same-net $overlap", ({ pad, via, expectedErrors }) => {
  const circuitJson = makeKnownNetCircuit({
    pad,
    via,
    padNetId: "source_net_gnd",
    viaNetId: "source_net_gnd",
  })

  for (const allowed of [undefined, false, true]) {
    circuitJson[0] = makeBoard(allowed)
    expect(checkViasInPads(circuitJson)).toHaveLength(
      allowed === true ? 0 : expectedErrors,
    )
  }
})
