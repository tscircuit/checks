import type { Bounds } from "lib/data-structures/SpatialIndex"
import type { PcbTraceSegment } from "./getCollidableBounds"

export const getClosestPointBetweenSegmentAndBounds = (
  segment: PcbTraceSegment,
  bounds: Bounds,
): { x: number; y: number } => {
  // Define segment points
  const p1 = { x: segment.x1, y: segment.y1 }
  const p2 = { x: segment.x2, y: segment.y2 }

  // Define bounds corners
  const minX = bounds.minX
  const minY = bounds.minY
  const maxX = bounds.maxX
  const maxY = bounds.maxY

  // Check if segment is a point
  if (p1.x === p2.x && p1.y === p2.y) {
    // For a point, find the closest point on the bounds
    const closestX = Math.max(minX, Math.min(maxX, p1.x))
    const closestY = Math.max(minY, Math.min(maxY, p1.y))

    // If the point is inside the bounds, return the point itself
    if (closestX === p1.x && closestY === p1.y) {
      return { x: p1.x, y: p1.y }
    }

    // Otherwise, return the closest point on the bounds
    return { x: closestX, y: closestY }
  }

  // Calculate direction vector of the segment
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y

  // Calculate parameter values for intersection with each boundary
  const tMinX = dx !== 0 ? (minX - p1.x) / dx : Number.NEGATIVE_INFINITY
  const tMaxX = dx !== 0 ? (maxX - p1.x) / dx : Number.POSITIVE_INFINITY
  const tMinY = dy !== 0 ? (minY - p1.y) / dy : Number.NEGATIVE_INFINITY
  const tMaxY = dy !== 0 ? (maxY - p1.y) / dy : Number.POSITIVE_INFINITY

  // Find the entering and exiting parameters
  const tEnter = Math.max(Math.min(tMinX, tMaxX), Math.min(tMinY, tMaxY))
  const tExit = Math.min(Math.max(tMinX, tMaxX), Math.max(tMinY, tMaxY))

  // Check if segment intersects the bounds
  if (tEnter <= tExit && tExit >= 0 && tEnter <= 1) {
    // Segment intersects bounds, clamp parameter to segment
    const t = Math.max(0, Math.min(1, tEnter))
    return {
      x: p1.x + t * dx,
      y: p1.y + t * dy,
    }
  }

  // Segment doesn't intersect bounds, find closest point
  // Check each endpoint of the segment against the bounds
  const closestToP1 = {
    x: Math.max(minX, Math.min(maxX, p1.x)),
    y: Math.max(minY, Math.min(maxY, p1.y)),
  }

  const closestToP2 = {
    x: Math.max(minX, Math.min(maxX, p2.x)),
    y: Math.max(minY, Math.min(maxY, p2.y)),
  }

  // Calculate distances
  const distToP1Squared =
    (closestToP1.x - p1.x) ** 2 + (closestToP1.y - p1.y) ** 2
  const distToP2Squared =
    (closestToP2.x - p2.x) ** 2 + (closestToP2.y - p2.y) ** 2

  // Check each edge of the bounds against the segment
  const edges = [
    { start: { x: minX, y: minY }, end: { x: maxX, y: minY } }, // Bottom edge
    { start: { x: maxX, y: minY }, end: { x: maxX, y: maxY } }, // Right edge
    { start: { x: maxX, y: maxY }, end: { x: minX, y: maxY } }, // Top edge
    { start: { x: minX, y: maxY }, end: { x: minX, y: minY } }, // Left edge
  ]

  let minDistance = Math.min(distToP1Squared, distToP2Squared)
  let closestPoint =
    distToP1Squared <= distToP2Squared ? closestToP1 : closestToP2

  // Helper function to clamp a value between min and max
  const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value))
  }

  // Check each edge
  for (const edge of edges) {
    // Calculate direction vectors
    const va = { x: p2.x - p1.x, y: p2.y - p1.y }
    const vb = { x: edge.end.x - edge.start.x, y: edge.end.y - edge.start.y }
    const w = { x: p1.x - edge.start.x, y: p1.y - edge.start.y }

    // Calculate dot products
    const dotAA = va.x * va.x + va.y * va.y
    const dotAB = va.x * vb.x + va.y * vb.y
    const dotAW = va.x * w.x + va.y * w.y
    const dotBB = vb.x * vb.x + vb.y * vb.y
    const dotBW = vb.x * w.x + vb.y * w.y

    // Calculate parameters for closest points
    const denominator = dotAA * dotBB - dotAB * dotAB

    // Skip if lines are parallel
    if (Math.abs(denominator) < 1e-10) continue

    let tA = (dotAB * dotBW - dotBB * dotAW) / denominator
    let tB = (dotAA * dotBW - dotAB * dotAW) / denominator

    // Clamp parameters to segment bounds
    tA = clamp(tA, 0, 1)
    tB = clamp(tB, 0, 1)

    // Calculate closest points
    const closestOnSegment = {
      x: p1.x + tA * va.x,
      y: p1.y + tA * va.y,
    }

    const closestOnEdge = {
      x: edge.start.x + tB * vb.x,
      y: edge.start.y + tB * vb.y,
    }

    // Calculate distance
    const dx = closestOnSegment.x - closestOnEdge.x
    const dy = closestOnSegment.y - closestOnEdge.y
    const distSquared = dx * dx + dy * dy

    // Update if this is closer
    if (distSquared < minDistance) {
      minDistance = distSquared
      closestPoint = {
        x: (closestOnSegment.x + closestOnEdge.x) / 2,
        y: (closestOnSegment.y + closestOnEdge.y) / 2,
      }
    }
  }

  return closestPoint
}
