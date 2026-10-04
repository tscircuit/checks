import { expect, test } from "bun:test"
import { Polygon } from "@flatten-js/core"
import {
  getCachedScaledCopperPolygon,
  getCopperPolygonGeometryKey,
  PcbConnectivityGeometryCache,
} from "lib/util/pcb-connectivity-geometry-cache"

test("geometry keys preserve signed zero and cache storage remains bounded", () => {
  const cache = new PcbConnectivityGeometryCache()
  const positiveZero = getCopperPolygonGeometryKey("via", [[{ x: 0 }, "x"]])!
  const negativeZero = getCopperPolygonGeometryKey("via", [[{ x: -0 }, "x"]])!
  expect(positiveZero).not.toBe(negativeZero)
  for (const value of [NaN, Infinity, -Infinity]) {
    expect(
      getCopperPolygonGeometryKey("via", [[{ x: value }, "x"]]),
    ).toBeUndefined()
  }
  let constructions = 0
  const createPolygon = (): Polygon => {
    constructions += 1
    return new Polygon()
  }
  for (let index = 0; index < 32770; index++) {
    getCachedScaledCopperPolygon(cache, `geometry:${index}`, 1e6, createPolygon)
  }
  expect(cache.getStats().entries).toBe(32768)
  getCachedScaledCopperPolygon(cache, "geometry:32769", 1e6, createPolygon)
  expect(constructions).toBe(32770)
  getCachedScaledCopperPolygon(cache, "geometry:0", 1e6, createPolygon)
  expect(constructions).toBe(32771)
  expect(cache.getStats().entries).toBe(32768)
  cache.clear()
  expect(cache.getStats()).toEqual({ hits: 0, misses: 0, entries: 0 })
})
