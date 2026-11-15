import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkViasInPads } from "../../index"
import importedJson from "../fixtures/flatpack2-xt60/imported.circuit.json"

// Original JC3 pads and vias from neggles/flatpack2-adapter, CC BY-SA 4.0.
// Source commit, conversion and extraction details are in the fixture's SOURCE.md.
const circuit = importedJson as AnyCircuitElement[]

test("XT60 connector: existing vias and reported via-in-pad errors", async () => {
  const errors = checkViasInPads(circuit)
  await expect(
    convertCircuitJsonToPcbSvg([...circuit, ...errors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
      includeVersion: false,
      width: 1000,
      height: 1100,
      viewport: { minX: -0.8, maxX: 11.1, minY: 13.2, maxY: 29.8 },
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})

test.failing(
  "detects all four source vias on JC3's polygon copper extensions",
  () => {
    expect(
      checkViasInPads(circuit)
        .map((error) => error.pcb_placement_error_id)
        .sort(),
    ).toEqual([
      "via_in_pad_pcb_via_100_pcb_plated_hole_32",
      "via_in_pad_pcb_via_101_pcb_plated_hole_32",
      "via_in_pad_pcb_via_84_pcb_plated_hole_34",
      "via_in_pad_pcb_via_85_pcb_plated_hole_34",
    ])
  },
)

test("allows the original same-net vias when the board permits via-in-pad", () => {
  const allowed = circuit.map((element) =>
    element.type === "pcb_board"
      ? { ...element, is_via_in_pad_allowed: true }
      : element,
  )
  expect(checkViasInPads(allowed)).toEqual([])
})
