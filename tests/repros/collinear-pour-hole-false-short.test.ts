import { expect, test } from "bun:test"
import * as Flatten from "@flatten-js/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkCopperPourShorts } from "../../lib/check-copper-pour-shorts"
import {
  collinearHole,
  createPourHoleCircuit,
  ordinaryHole,
  padHeight,
  padWidth,
  padY,
  safePadX,
} from "../fixtures/collinear-pour-hole"

test("collinear hole does not short an isolated pad", async (): Promise<void> => {
  const ordinaryPolygon = new Flatten.Polygon(
    ordinaryHole.map(({ x, y }): Flatten.Point => new Flatten.Point(x, y)),
  )
  const collinearPolygon = new Flatten.Polygon(
    collinearHole.map(({ x, y }): Flatten.Point => new Flatten.Point(x, y)),
  )
  expect(ordinaryPolygon.isValid()).toBe(true)
  expect(collinearPolygon.isValid()).toBe(true)
  expect(ordinaryPolygon.area()).toBe(30)
  expect(collinearPolygon.area()).toBe(30)
  expect(collinearPolygon.box).toEqual(ordinaryPolygon.box)

  // Independent rectangular containment: every pad corner is strictly inside
  // the hole, so the pad cannot touch copper. Do not use the defective contains
  // operation itself as the oracle for the expected physical result.
  for (const x of [safePadX - padWidth / 2, safePadX + padWidth / 2]) {
    for (const y of [padY - padHeight / 2, padY + padHeight / 2]) {
      expect(x).toBeGreaterThan(-3)
      expect(x).toBeLessThan(3)
      expect(y).toBeGreaterThan(31)
      expect(y).toBeLessThan(36)
    }
  }
  expect(padY - padHeight / 2).toBe(33.07)

  const cases = [
    { name: "ordinary-hole-safe-pad", circuit: createPourHoleCircuit({}) },
    {
      name: "collinear-hole-safe-pad",
      circuit: createPourHoleCircuit({ collinearVertices: true }),
    },
    {
      name: "real-short-control",
      circuit: createPourHoleCircuit({ collinearVertices: true, padX: 4 }),
    },
  ]
  const errors = cases.map(({ circuit }) => checkCopperPourShorts(circuit))
  expect(errors[0]).toEqual([])
  expect(errors[2]).toHaveLength(1)
  expect(errors[2][0].message).toContain("J_USB.SIGNAL")

  // Snapshot actual returned findings. No error is fabricated, filtered or
  // suppressed; the real-short control must keep its diagnostic overlay.
  for (const [index, scenario] of cases.entries()) {
    await expect(
      convertCircuitJsonToPcbSvg([...scenario.circuit, ...errors[index]], {
        width: 1000,
        height: 760,
        layer: "top",
        viewport: { minX: -6, maxX: 6, minY: 29, maxY: 38 },
        backgroundColor: "white",
        shouldDrawErrors: true,
        showErrorsInTextOverlay: true,
        includeVersion: false,
      }),
    ).toMatchSvgSnapshot(import.meta.path, scenario.name)
  }

  // A collinear subdivision must not change the physically correct result.
  expect(errors[1]).toEqual([])
})
