import type { Bounds } from "lib/data-structures/SpatialIndex"

/**
 * Are two bounds overlapping?
 *
 * If there is a margin, we increase one of the bounds by the margin
 */
export const areBoundsOverlapping = (
  bounds1: Bounds,
  bounds2: Bounds,
  margin = 0,
) => {
  return (
    bounds1.minX <= bounds2.maxX + margin &&
    bounds1.maxX >= bounds2.minX - margin &&
    bounds1.minY <= bounds2.maxY + margin &&
    bounds1.maxY >= bounds2.minY - margin
  )
}
