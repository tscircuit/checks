import type { Bounds } from "lib/data-structures/SpatialIndex"

export const areBoundsOverlapping = (bounds1: Bounds, bounds2: Bounds) => {
  return (
    bounds1.minX <= bounds2.maxX &&
    bounds1.maxX >= bounds2.minX &&
    bounds1.minY <= bounds2.maxY &&
    bounds1.maxY >= bounds2.minY
  )
}
