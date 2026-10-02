import { expect, test } from "bun:test"
import { bendZoneVisual } from "../fixtures/pcb-bend-zones-visual"

test("visualizes parts outside a finite bend and a perpendicular crossing", () => {
  const { placement, routing, svg } = bendZoneVisual(true)
  expect(placement).toEqual([])
  expect(routing).toEqual([])
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
