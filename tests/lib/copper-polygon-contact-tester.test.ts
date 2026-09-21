import { expect, test } from "bun:test"
import { Box, Circle, Point, Polygon } from "@flatten-js/core"
import { copperPolygonsTouch } from "@tscircuit/circuit-json-util"
import { createCopperPolygonContactTester } from "lib/copper-pour-connectivity/create-copper-polygon-contact-tester"

const scale = 1e6
const tolerance = 1e-7 * scale
const rectangle = (x: number, y: number, w: number, h: number) =>
  new Polygon(new Box(x, y, x + w, y + h)).scale(scale, scale)
const circle = (x: number, y: number, radius: number) =>
  new Polygon(new Circle(new Point(x, y), radius)).scale(scale, scale)

function compare(a: Polygon, b: Polygon, expected: boolean) {
  const touches = createCopperPolygonContactTester(tolerance)
  const originalA = a.toJSON()
  const originalB = b.toJSON()
  expect(copperPolygonsTouch(a, b, tolerance)).toBe(expected)
  expect(touches(a, b)).toBe(expected)
  expect(touches(b, a)).toBe(expected)
  // Cached geometry must give the same result and leave polygons untouched.
  expect(touches(a, b)).toBe(expected)
  expect(a.toJSON()).toEqual(originalA)
  expect(b.toJSON()).toEqual(originalB)
}

test("contacts include containment, crossings, tangent arcs and tolerance-sized gaps", () => {
  compare(rectangle(-5, -5, 10, 10), circle(0, 0, 1), true)
  // Neither rectangle contains a vertex of the other.
  compare(rectangle(-3, -0.1, 6, 0.2), rectangle(-0.1, -3, 0.2, 6), true)
  compare(circle(0, 0, 1), circle(2, 0, 1), true)
  compare(rectangle(-1, -1, 2, 2), circle(2, 0, 1), true)
  compare(rectangle(0, 0, 1, 1), rectangle(1 + 0.5e-7, 0, 1, 1), true)
  compare(rectangle(0, 0, 1, 1), rectangle(1 + 2e-7, 0, 1, 1), false)
  compare(circle(0, 0, 1), circle(2 + 0.5e-7, 0, 1), true)
  compare(circle(0, 0, 1), circle(2 + 2e-7, 0, 1), false)
})

test("holes and separate faces do not become filled copper", () => {
  const donut = new Polygon(new Circle(new Point(0, 0), 4))
  const hole = donut.addFace(new Circle(new Point(0, 0), 2))
  hole.reverse()
  const ring = donut.scale(scale, scale)
  compare(ring, circle(0, 0, 1), false)
  compare(ring, circle(0, 0, 2), true)
  compare(ring, rectangle(1.9, -0.1, 0.2, 0.2), true)

  const islands = new Polygon(new Box(-4, -1, -2, 1))
  islands.addFace(new Box(2, -1, 4, 1))
  const scaled = islands.scale(scale, scale)
  compare(scaled, circle(3, 0, 0.1), true)
  compare(scaled, circle(0, 0, 0.1), false)
  // Containment of a later face must be tested too.
  compare(scaled, rectangle(1, -2, 4, 4), true)
  const touches = createCopperPolygonContactTester(tolerance)
  expect(touches(new Polygon(), scaled)).toBe(false)
  expect(touches(scaled, new Polygon())).toBe(false)
})

test("indexed contact matches the old predicate for seeded mixed curved and rotated geometry", () => {
  let seed = 971
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32
  const shapes = Array.from({ length: 60 }, (_, i) => {
    const x = random() * 10
    const y = random() * 10
    const size = 0.1 + random() * 2
    return i % 2
      ? circle(x, y, size)
      : rectangle(x, y, size, size / 3).rotate(random() * Math.PI)
  })
  const touches = createCopperPolygonContactTester(tolerance)
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const expected = copperPolygonsTouch(shapes[i], shapes[j], tolerance)
      expect(touches(shapes[i], shapes[j])).toBe(expected)
      expect(touches(shapes[j], shapes[i])).toBe(expected)
    }
  }
})
