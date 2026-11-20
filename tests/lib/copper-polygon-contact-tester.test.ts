import { expect, test } from "bun:test"
import { createRequire } from "node:module"
import { Arc, Box, Circle, Point, Polygon, Segment } from "@flatten-js/core"
import { copperPolygonsTouch } from "@tscircuit/circuit-json-util"
import { createCopperPolygonContactTester } from "lib/copper-pour-connectivity/create-copper-polygon-contact-tester"
import {
  collinearHole,
  padHeight,
  padWidth,
  padY,
  safePadX,
} from "../fixtures/collinear-pour-hole"

const scale = 1e6
const tolerance = 1e-7 * scale
const rectangle = (x: number, y: number, w: number, h: number) =>
  new Polygon(new Box(x, y, x + w, y + h)).scale(scale, scale)
const circle = (x: number, y: number, radius: number) =>
  new Polygon(new Circle(new Point(x, y), radius)).scale(scale, scale)

const other = createRequire(import.meta.url)(
  "@flatten-js/core",
) as typeof import("@flatten-js/core")
const foreign = (polygon: Polygon) =>
  new other.Polygon(
    polygon.toJSON() as ConstructorParameters<typeof Polygon>[0],
  )

function compare(a: Polygon, b: Polygon, expected: boolean) {
  const touches = createCopperPolygonContactTester(tolerance)
  const foreignA = foreign(a)
  const foreignB = foreign(b)
  const originalA = a.toJSON()
  const originalB = b.toJSON()
  expect(other.Polygon).not.toBe(Polygon)
  expect(copperPolygonsTouch(a, b, tolerance)).toBe(expected)

  // Local, mixed and foreign inputs must agree in both argument orders.
  expect(touches(a, b)).toBe(expected)
  expect(touches(b, a)).toBe(expected)
  expect(touches(a, foreignB)).toBe(expected)
  expect(touches(foreignB, a)).toBe(expected)
  expect(touches(foreignA, foreignB)).toBe(expected)
  expect(touches(foreignB, foreignA)).toBe(expected)

  // Cached geometry must give the same result and leave every input untouched.
  expect(touches(a, b)).toBe(expected)
  expect(touches(a, foreignB)).toBe(expected)
  expect(touches(foreignA, foreignB)).toBe(expected)
  expect(a.toJSON()).toEqual(originalA)
  expect(b.toJSON()).toEqual(originalB)
  expect(foreignA.toJSON()).toEqual(originalA)
  expect(foreignB.toJSON()).toEqual(originalB)
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
  expect(touches(new other.Polygon(), scaled)).toBe(false)
  expect(touches(scaled, new other.Polygon())).toBe(false)
  expect(touches(new other.Polygon(), new Polygon())).toBe(false)
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

test("does not report false contact across collinear hole vertices or grazing arc tangent rays", () => {
  const touches = createCopperPolygonContactTester(tolerance)
  const pourWithCollinearHole = new Polygon()
  pourWithCollinearHole.addFace(new Box(-10, 25, 10, 40))
  pourWithCollinearHole.addFace(
    [...collinearHole].reverse().map(({ x, y }) => new Point(x, y)),
  )
  const scaledPour = pourWithCollinearHole.scale(scale, scale)
  const enclosedPad = rectangle(
    safePadX - padWidth / 2,
    padY - padHeight / 2,
    padWidth,
    padHeight,
  )
  expect(touches(scaledPour, enclosedPad)).toBe(false)
  expect(touches(enclosedPad, scaledPour)).toBe(false)
  expect(touches(foreign(scaledPour), foreign(enclosedPad))).toBe(false)

  // A wide trace cap whose top tangent lies 1e-6 scaled units above a distant
  // pour vertex inside its bounding box is still separated by 0.5 mm.
  const wideCap = new Polygon()
  wideCap.addFace([
    new Arc(new Point(5e6, 9e6 - 1e5 + 1e-6), 1e5, 0, Math.PI, true),
    new Segment(new Point(5e6 - 1e5, 9e6 - 1e5 + 1e-6), new Point(-60e6, -3e6)),
    new Segment(new Point(-60e6, -3e6), new Point(5e6 + 1e5, 9e6 - 1e5 + 1e-6)),
  ])
  const separatedPour = new Polygon([
    new Point(-56.8e6, 9e6),
    new Point(-63e6, 9e6),
    new Point(-63e6, 14.5e6),
    new Point(10e6, 14.5e6),
    new Point(10e6, 9.5e6),
    new Point(-56.8e6, 9.5e6),
  ])
  expect(touches(wideCap, separatedPour)).toBe(false)
  expect(touches(separatedPour, wideCap)).toBe(false)
})
