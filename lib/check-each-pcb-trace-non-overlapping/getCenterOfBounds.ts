import type { Bounds } from "lib/data-structures/SpatialIndex"

/**
 * Get the center point of a bounds object
 */
export const getCenterOfBounds = (bounds: Bounds) => {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  }
}
