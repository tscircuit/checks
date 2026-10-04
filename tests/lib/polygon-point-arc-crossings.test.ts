import { expect, test } from "bun:test"
import * as Flatten from "@flatten-js/core"
import { polygonContainsPoint } from "../../lib/util/polygon-contains-point"

test("analytic arc crossings preserve tangencies and segment joins in both directions", (): void => {
  for (const center of [new Flatten.Point(0, 0), new Flatten.Point(10, -7)]) {
    for (const reverse of [false, true]) {
      const cap = new Flatten.Polygon()
      cap.addFace([
        new Flatten.Arc(center, 2, 0, Math.PI, true),
        new Flatten.Segment(
          new Flatten.Point(center.x - 2, center.y),
          new Flatten.Point(center.x + 2, center.y),
        ),
      ])
      if (reverse) cap.reverse()
      for (const [x, y, expected] of [
        [-3, 0, false],
        [3, 0, false],
        [-3, 2, false],
        [3, 2, false],
        [0, 2, true],
        [0, 0, true],
        [0, 1, true],
        [0, -1, false],
      ] as const) {
        expect(
          polygonContainsPoint(
            cap,
            new Flatten.Point(center.x + x, center.y + y),
          ),
        ).toBe(expected)
      }

      const circle = new Flatten.Polygon(new Flatten.Circle(center, 2))
      if (reverse) circle.reverse()
      for (const x of [-3, -1, 0, 1, 3]) {
        for (const y of [-2, -1, 0, 1, 2]) {
          expect(
            polygonContainsPoint(
              circle,
              new Flatten.Point(center.x + x, center.y + y),
            ),
          ).toBe(x * x + y * y <= 4)
        }
      }

      for (const angle of [0, 0.3, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const arc = new Flatten.Arc(center, 2, angle, angle + Math.PI, true)
        const rotatedCap = new Flatten.Polygon()
        rotatedCap.addFace([arc, new Flatten.Segment(arc.end, arc.start)])
        if (reverse) rotatedCap.reverse()
        const original = rotatedCap.toJSON()
        // These rays pass exactly through either arc/segment join, but every
        // query is strictly outside the circle regardless of its rotation.
        for (const y of [arc.start.y, arc.end.y]) {
          for (const x of [center.x - 3, center.x + 3]) {
            expect(
              polygonContainsPoint(rotatedCap, new Flatten.Point(x, y)),
            ).toBe(false)
          }
        }
        for (const radius of [-1, 1]) {
          const point = new Flatten.Point(0, radius)
            .rotate(angle)
            .translate(new Flatten.Vector(center.x, center.y))
          expect(polygonContainsPoint(rotatedCap, point)).toBe(radius > 0)
        }
        expect(rotatedCap.toJSON()).toEqual(original)

        const disk = new Flatten.Polygon()
        disk.addFace([
          new Flatten.Arc(center, 2, angle, angle + 2 * Math.PI, true),
        ])
        if (reverse) disk.reverse()
        for (const x of [-3, -1, 0, 1, 3]) {
          for (const y of [-2, -1, 0, 1, 2]) {
            expect(
              polygonContainsPoint(
                disk,
                new Flatten.Point(center.x + x, center.y + y),
              ),
            ).toBe(x * x + y * y <= 4)
          }
        }
      }
    }
  }
})
