import { expect, spyOn, test } from "bun:test"
import * as Flatten from "@flatten-js/core"
import { polygonContainsPoint } from "../../lib/util/polygon-contains-point"

test("point queries never rebuild a large mixed arc/segment face", (): void => {
  const center = new Flatten.Point(0, 0)
  const shapes: (Flatten.Segment | Flatten.Arc)[] = [
    new Flatten.Arc(center, 5, 0, Math.PI, true),
  ]
  for (let i = 0; i < 768; i++) {
    const start = Math.PI + (i * Math.PI) / 768
    const end = Math.PI + ((i + 1) * Math.PI) / 768
    shapes.push(
      new Flatten.Segment(
        new Flatten.Point(5 * Math.cos(start), 5 * Math.sin(start)),
        new Flatten.Point(5 * Math.cos(end), 5 * Math.sin(end)),
      ),
    )
  }
  const polygon = new Flatten.Polygon()
  polygon.addFace(shapes)
  const original = polygon.toJSON()
  const rebuild = spyOn(Flatten.Polygon.prototype, "addFace")
  const clone = spyOn(Flatten.Segment.prototype, "clone")
  try {
    for (let i = 0; i < 100; i++) {
      expect(polygonContainsPoint(polygon, new Flatten.Point(i / 100, 1))).toBe(
        true,
      )
    }
    expect(rebuild).not.toHaveBeenCalled()
    expect(clone).not.toHaveBeenCalled()
    expect(polygon.toJSON()).toEqual(original)
  } finally {
    rebuild.mockRestore()
    clone.mockRestore()
  }
})
