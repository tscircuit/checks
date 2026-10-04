import { expect, test } from "bun:test"
import * as Flatten from "@flatten-js/core"
import { createPolygonPointTester } from "../../lib/util/create-polygon-point-tester"

function addRing(
  polygon: Flatten.Polygon,
  vertices: [number, number][],
): void {
  polygon.addFace(
    vertices.map(
      (start, index): Flatten.Segment =>
        new Flatten.Segment(
          new Flatten.Point(...start),
          new Flatten.Point(...vertices[(index + 1) % vertices.length]),
        ),
    ),
  )
}

test("half-open crossings preserve holes, winding, boundaries and analytic curves", (): void => {
  const contains = createPolygonPointTester()
  // Deliberately construct segments without dropping tolerance-sized edges.
  for (const gap of [0.25e-6, 1e-6, 2e-6, 4e-6]) {
    for (const reverse of [false, true]) {
      for (const offset of [0, -33.07, 100]) {
        const polygon = new Flatten.Polygon()
        addRing(polygon, [
          [-10, 25 + offset],
          [10, 25 + offset],
          [10, 40 + offset],
          [-10, 40 + offset],
        ])
        const hole: [number, number][] = [
          [-3, 31 + offset],
          [3, 31 + offset],
          [3, 33.07 - gap / 2 + offset],
          [3, 33.07 + gap / 2 + offset],
          [3, 36 + offset],
          [-3, 36 + offset],
        ]
        addRing(polygon, reverse ? hole.reverse() : hole)
        const original = polygon.toJSON()
        for (const y of [31.5, 33.07 - gap / 2, 33.07, 33.07 + gap / 2, 35.5]) {
          // Independent rectangle oracle: strict interior of the cutout.
          expect(contains(polygon, new Flatten.Point(-0.4, y + offset))).toBe(
            false,
          )
          expect(contains(polygon, new Flatten.Point(4, y + offset))).toBe(true)
        }
        expect(contains(polygon, new Flatten.Point(3, 33.07 + offset))).toBe(
          true,
        )
        expect(contains(polygon, new Flatten.Point(0, 31 + offset))).toBe(true)
        expect(contains(polygon, new Flatten.Point(11, 33.07 + offset))).toBe(
          false,
        )
        expect(polygon.toJSON()).toEqual(original)
      }
    }
  }

  const islands = new Flatten.Polygon(new Flatten.Box(-4, -1, -2, 1))
  islands.addFace(new Flatten.Box(2, -1, 4, 1))
  expect(contains(islands, new Flatten.Point(-3, 0))).toBe(true)
  expect(contains(islands, new Flatten.Point(3, 0))).toBe(true)
  expect(contains(islands, new Flatten.Point(0, 0))).toBe(false)
  expect(contains(new Flatten.Polygon(), new Flatten.Point(0, 0))).toBe(false)

  const joggedHole = new Flatten.Polygon(new Flatten.Box(-10, 25, 10, 40))
  addRing(joggedHole, [
    [-3, 31],
    [3, 31],
    [3 - 0.5e-6, 33.069999],
    [3 + 0.5e-6, 33.070001],
    [3, 36],
    [-3, 36],
  ])
  // The same crossing rule also handles a genuinely non-collinear tiny edge;
  // no simplification, vertex deletion or coordinate perturbation is applied.
  expect(contains(joggedHole, new Flatten.Point(-0.4, 33.07))).toBe(false)
  expect(contains(joggedHole, new Flatten.Point(4, 33.07))).toBe(true)
  const originalJog = joggedHole.toJSON()
  for (const angle of [Math.PI / 4, -Math.PI / 2, 0.3]) {
    const rotated = joggedHole.rotate(angle)
    expect(contains(rotated, new Flatten.Point(-0.4, 33.07).rotate(angle))).toBe(
      false,
    )
    expect(contains(rotated, new Flatten.Point(4, 33.07).rotate(angle))).toBe(
      true,
    )
  }
  expect(joggedHole.toJSON()).toEqual(originalJog)

  const curvedOuter = new Flatten.Polygon(
    new Flatten.Circle(new Flatten.Point(0, 33.5), 10),
  )
  addRing(curvedOuter, [
    [-3, 31],
    [3, 31],
    [3, 33.069999],
    [3, 33.070001],
    [3, 36],
    [-3, 36],
  ])
  expect(contains(curvedOuter, new Flatten.Point(-0.4, 33.07))).toBe(false)
  expect(contains(curvedOuter, new Flatten.Point(4, 33.07))).toBe(true)

  const curvedHole = new Flatten.Polygon(new Flatten.Box(-5, -5, 5, 5))
  curvedHole.addFace(new Flatten.Circle(new Flatten.Point(0, 0), 2))
  expect(contains(curvedHole, new Flatten.Point(1.3, 1.3))).toBe(false)
  expect(contains(curvedHole, new Flatten.Point(1.5, 1.5))).toBe(true)
  expect(contains(curvedHole, new Flatten.Point(2, 0))).toBe(true)

  const disk = new Flatten.Polygon(new Flatten.Circle(new Flatten.Point(0, 0), 2))
  for (const x of [-3, -1, 0, 1, 3]) {
    for (const y of [-3, -1, 0, 1, 3]) {
      expect(contains(disk, new Flatten.Point(x, y))).toBe(x * x + y * y <= 4)
    }
  }
})
