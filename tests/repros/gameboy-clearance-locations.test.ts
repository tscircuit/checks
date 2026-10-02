import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { renderClearanceLocations } from "../fixtures/render-clearance-locations"
import raw from "../assets/gameboy-advance-clearance.json"
import { checkPadTraceClearance } from "../../lib/check-pad-trace-clearance"
import { checkViaTraceClearance } from "../../lib/check-via-trace-clearance"
import { checkViaPadClearance } from "../../lib/check-via-pad-clearance"
import { checkViasInPads } from "../../lib/check-vias-in-pads"

const circuit = (raw as AnyCircuitElement[]).filter(
  (element) => !element.type.endsWith("_error"),
)
const supplied = (raw as AnyCircuitElement[]).filter((element) =>
  element.type.endsWith("_clearance_error"),
)

test("Game Boy Advance: place all 11 clearance markers at the offending copper", () => {
  const errors = [
    ...checkPadTraceClearance(circuit),
    ...checkViaTraceClearance(circuit),
    ...checkViaPadClearance(circuit),
  ]
  expect(errors).toHaveLength(11)
  // Generated IDs are reassigned by core in the supplied export.
  for (const [index, error] of errors.entries()) {
    const {
      [`${error.type}_id`]: _id,
      center: _oldCenter,
      message: _oldMessage,
      ...expected
    } = supplied[index] as any
    expect(error).toMatchObject(expected)
    expect(error.message).not.toMatch(
      /\b(?:pcb|source|schematic)_[a-z0-9_]+\b/i,
    )
  }
  expect(errors.map(({ center }) => center)).toMatchSnapshot()
  expect(
    convertCircuitJsonToPcbSvg([...circuit, ...errors], {
      shouldDrawErrors: true,
      width: 1200,
      height: 500,
      viewport: { minX: -10, maxX: 35, minY: 8, maxY: 25 },
    }),
  ).toMatchSvgSnapshot(import.meta.path, "gameboy-clearance-renderer")
  expect(renderClearanceLocations(circuit, errors)).toMatchSvgSnapshot(
    import.meta.path,
  )
})

test("Game Boy Advance: copper-only via overlaps are not via-in-pad", () => {
  // The 11 copper-clearance errors above still apply. None of the five
  // overlapping via rings places its drilled hole inside a pad.
  expect(checkViasInPads(circuit)).toMatchInlineSnapshot(`[]`)
})
