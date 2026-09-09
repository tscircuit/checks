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

test("Game Boy Advance: reproduce all 11 supplied clearance markers", () => {
  const errors = [
    ...checkPadTraceClearance(circuit),
    ...checkViaTraceClearance(circuit),
    ...checkViaPadClearance(circuit),
  ]
  expect(errors).toHaveLength(11)
  // Generated IDs are reassigned by core in the supplied export.
  for (const [index, error] of errors.entries()) {
    const { [`${error.type}_id`]: _id, ...expected } = supplied[index] as any
    expect(error).toMatchObject(expected)
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

test("Game Boy Advance: via-in-pad placement error has no marker position", () => {
  const errors = checkViasInPads(circuit)
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    pcb_placement_error_id: "via_in_pad_pcb_via_192_pcb_smtpad_0",
    message:
      "Via copper at (0.56mm, 15.10mm) overlaps SMD pad U1.GND at (0.00mm, 17.00mm)",
  })
  expect(errors[0]).not.toHaveProperty("center")
})
