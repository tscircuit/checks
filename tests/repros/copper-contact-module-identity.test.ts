import { expect, test } from "bun:test"
import { createRequire } from "node:module"
import { Box, Polygon } from "@flatten-js/core"
import { createCopperPolygonContactTester } from "lib/copper-pour-connectivity/create-copper-polygon-contact-tester"

test("copper contact accepts polygons with independent Flatten constructors", () => {
  // The package's ESM and CJS entrypoints provide real independent constructors,
  // as can happen when the checker and a geometry producer load separate copies.
  const other = createRequire(import.meta.url)(
    "@flatten-js/core",
  ) as typeof import("@flatten-js/core")
  expect(other.Polygon).not.toBe(Polygon)

  // Overlapping strips with no contained vertices force the edge-distance path.
  // Use the same coordinate scale and tolerance as copper connectivity checks.
  const horizontal = new Polygon(new Box(-2, -0.25, 2, 0.25)).scale(1e6, 1e6)
  const vertical = new Polygon(new Box(0.4, -2, 0.9, 2)).scale(1e6, 1e6)
  const foreignVertical = new other.Polygon(
    new other.Box(0.4e6, -2e6, 0.9e6, 2e6),
  )
  const touches = createCopperPolygonContactTester(0.1)

  expect(touches(horizontal, vertical)).toBe(true)
  expect(touches(horizontal, foreignVertical)).toBe(true)
  expect(touches(foreignVertical, horizontal)).toBe(true)
})
