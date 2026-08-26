import { expect, test } from "bun:test"
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
    overlap: "issue #241 corner-only overlap",
    pad: issueCornerPad,
    via: issueCornerVia,
  },
])("reports a different-net $overlap", ({ pad, via }) => {
  const circuitJson = makeKnownNetCircuit({
    pad,
    via,
    padNetId: "source_net_sig",
    viaNetId: "source_net_gnd",
  })

  expect(checkViasInPads(circuitJson)).toHaveLength(1)
})
