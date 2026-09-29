import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkViasInPads } from "lib/check-vias-in-pads"
import {
  makeBoard,
  makeKnownNetCircuit,
  viaInRectPad,
} from "./check-vias-in-pads-fixtures"

test("reports a same-net via drill in a pad when via-in-pad is disabled", () => {
  const circuitJson = makeKnownNetCircuit({
    padNetId: "GND",
    viaNetId: "GND",
    via: { ...viaInRectPad, outer_diameter: 0.45, hole_diameter: 0.3 },
  })
  circuitJson[0] = { ...makeBoard(false), width: 3, height: 3 }

  expect(convertCircuitJsonToPcbSvg(circuitJson)).toMatchSvgSnapshot(
    import.meta.path,
  )
  expect(checkViasInPads(circuitJson)).toHaveLength(1)
})
