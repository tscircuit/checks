import type { Bounds } from "lib/data-structures/SpatialIndex"

export const getCenterOfBoundsPair = (bounds1: Bounds, bounds2: Bounds) => {
  return {
    x:
      (Math.min(bounds1.minX, bounds2.minX) +
        Math.max(bounds1.maxX, bounds2.maxX)) /
      2,
    y:
      (Math.min(bounds1.minY, bounds2.minY) +
        Math.max(bounds1.maxY, bounds2.maxY)) /
      2,
  }
}
