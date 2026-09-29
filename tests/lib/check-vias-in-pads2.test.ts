import { expect, test } from "bun:test"
import { checkViaPadClearance } from "lib/check-via-pad-clearance"
import { checkViasInPads } from "lib/check-vias-in-pads"
import {
  makeBoard,
  issueCornerPad,
  issueCornerVia,
  makeKnownNetCircuit,
  rectPad,
  viaInRectPad,
} from "./check-vias-in-pads-fixtures"

test.each([
  {
    overlap: "center overlap",
    expectedViaInPadErrors: 1,
    pad: rectPad,
    via: viaInRectPad,
  },
  {
    overlap: "issue #241 corner-only overlap",
    expectedViaInPadErrors: 0,
    pad: issueCornerPad,
    via: issueCornerVia,
  },
])(
  "reports a different-net $overlap",
  ({ pad, via, expectedViaInPadErrors }) => {
    const circuitJson = makeKnownNetCircuit({
      pad,
      via,
      padNetId: "source_net_sig",
      viaNetId: "source_net_gnd",
    })

    expect(checkViasInPads(circuitJson)).toHaveLength(expectedViaInPadErrors)
    expect(checkViaPadClearance(circuitJson)).toHaveLength(1)

    circuitJson[0] = makeBoard(true)
    expect(checkViasInPads(circuitJson)).toEqual([])
    expect(checkViaPadClearance(circuitJson)).toHaveLength(1)
  },
)
