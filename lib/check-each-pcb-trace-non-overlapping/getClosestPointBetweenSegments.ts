import type { PcbTraceSegment } from "./getCollidableBounds"

export const getClosestPointBetweenSegments = (
  segmentA: PcbTraceSegment,
  segmentB: PcbTraceSegment,
): { x: number; y: number } => {
  // Define points for each segment
  const a1 = { x: segmentA.x1, y: segmentA.y1 }
  const a2 = { x: segmentA.x2, y: segmentA.y2 }
  const b1 = { x: segmentB.x1, y: segmentB.y1 }
  const b2 = { x: segmentB.x2, y: segmentB.y2 }

  // Calculate direction vectors for each segment
  const va = { x: a2.x - a1.x, y: a2.y - a1.y }
  const vb = { x: b2.x - b1.x, y: b2.y - b1.y }

  // Calculate squared lengths of segments
  const lenSqrA = va.x * va.x + va.y * va.y
  const lenSqrB = vb.x * vb.x + vb.y * vb.y

  // If either segment is a point (zero length), handle as special case
  if (lenSqrA === 0 || lenSqrB === 0) {
    if (lenSqrA === 0 && lenSqrB === 0) {
      // Both segments are points, return the distance between them
      // Calculate the average point
      return {
        x: (a1.x + b1.x) / 2,
        y: (a1.y + b1.y) / 2,
      }
    }
    if (lenSqrA === 0) {
      // First segment is a point, find closest point on second segment
      const t = clamp(
        ((a1.x - b1.x) * vb.x + (a1.y - b1.y) * vb.y) / lenSqrB,
        0,
        1,
      )
      const closestOnB = {
        x: b1.x + t * vb.x,
        y: b1.y + t * vb.y,
      }
      // Calculate the average point
      return {
        x: (a1.x + closestOnB.x) / 2,
        y: (a1.y + closestOnB.y) / 2,
      }
    }
    // Second segment is a point, find closest point on first segment
    const t = clamp(
      ((b1.x - a1.x) * va.x + (b1.y - a1.y) * va.y) / lenSqrA,
      0,
      1,
    )
    const closestOnA = {
      x: a1.x + t * va.x,
      y: a1.y + t * va.y,
    }
    // Calculate the average point
    return {
      x: (closestOnA.x + b1.x) / 2,
      y: (closestOnA.y + b1.y) / 2,
    }
  }

  // Vector between segment starting points
  const w = { x: a1.x - b1.x, y: a1.y - b1.y }

  // Calculate dot products
  const dotAA = va.x * va.x + va.y * va.y
  const dotAB = va.x * vb.x + va.y * vb.y
  const dotAW = va.x * w.x + va.y * w.y
  const dotBB = vb.x * vb.x + vb.y * vb.y
  const dotBW = vb.x * w.x + vb.y * w.y

  // Calculate parametric positions (t values) along each segment
  const denominator = dotAA * dotBB - dotAB * dotAB

  // If segments are parallel, handle separately
  if (denominator < 1e-10) {
    return closestPointsParallelSegments(
      a1,
      a2,
      b1,
      b2,
      va,
      vb,
      lenSqrA,
      lenSqrB,
    )
  }

  // Calculate parameters for closest points
  let tA = (dotAB * dotBW - dotBB * dotAW) / denominator
  let tB = (dotAA * dotBW - dotAB * dotAW) / denominator

  // Clamp parameters to segment bounds
  tA = clamp(tA, 0, 1)
  tB = clamp(tB, 0, 1)

  // Recalculate tB if tA was clamped
  tB = (tA * dotAB + dotBW) / dotBB
  tB = clamp(tB, 0, 1)

  // Recalculate tA if tB was clamped
  tA = (tB * dotAB - dotAW) / dotAA
  tA = clamp(tA, 0, 1)

  // Calculate closest points on each segment
  const closestOnA = {
    x: a1.x + tA * va.x,
    y: a1.y + tA * va.y,
  }

  const closestOnB = {
    x: b1.x + tB * vb.x,
    y: b1.y + tB * vb.y,
  }

  // Calculate distance between closest points
  const dx = closestOnA.x - closestOnB.x
  const dy = closestOnA.y - closestOnB.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  // Calculate the average of the closest points
  const averagePoint = {
    x: (closestOnA.x + closestOnB.x) / 2,
    y: (closestOnA.y + closestOnB.y) / 2,
  }

  return averagePoint
}

// Helper function for handling parallel segments
const closestPointsParallelSegments = (
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
  va: { x: number; y: number },
  vb: { x: number; y: number },
  lenSqrA: number,
  lenSqrB: number,
) => {
  // Project b1 onto segment A
  let tA = ((b1.x - a1.x) * va.x + (b1.y - a1.y) * va.y) / lenSqrA
  tA = clamp(tA, 0, 1)
  const pointOnA1 = { x: a1.x + tA * va.x, y: a1.y + tA * va.y }

  // Project b2 onto segment A
  let tA2 = ((b2.x - a1.x) * va.x + (b2.y - a1.y) * va.y) / lenSqrA
  tA2 = clamp(tA2, 0, 1)
  const pointOnA2 = { x: a1.x + tA2 * va.x, y: a1.y + tA2 * va.y }

  // Project a1 onto segment B
  let tB = ((a1.x - b1.x) * vb.x + (a1.y - b1.y) * vb.y) / lenSqrB
  tB = clamp(tB, 0, 1)
  const pointOnB1 = { x: b1.x + tB * vb.x, y: b1.y + tB * vb.y }

  // Project a2 onto segment B
  let tB2 = ((a2.x - b1.x) * vb.x + (a2.y - b1.y) * vb.y) / lenSqrB
  tB2 = clamp(tB2, 0, 1)
  const pointOnB2 = { x: b1.x + tB2 * vb.x, y: b1.y + tB2 * vb.y }

  // Calculate all possible distances between end points and their projections
  const distances = [
    {
      pointA: pointOnA1,
      pointB: b1,
      distance: Math.sqrt(
        (pointOnA1.x - b1.x) ** 2 + (pointOnA1.y - b1.y) ** 2,
      ),
    },
    {
      pointA: pointOnA2,
      pointB: b2,
      distance: Math.sqrt(
        (pointOnA2.x - b2.x) ** 2 + (pointOnA2.y - b2.y) ** 2,
      ),
    },
    {
      pointA: a1,
      pointB: pointOnB1,
      distance: Math.sqrt(
        (a1.x - pointOnB1.x) ** 2 + (a1.y - pointOnB1.y) ** 2,
      ),
    },
    {
      pointA: a2,
      pointB: pointOnB2,
      distance: Math.sqrt(
        (a2.x - pointOnB2.x) ** 2 + (a2.y - pointOnB2.y) ** 2,
      ),
    },
  ]

  // Find closest pair
  const closestPair = distances.reduce((closest, current) =>
    current.distance < closest.distance ? current : closest,
  )

  // Calculate the average of the closest points
  return {
    x: (closestPair.pointA.x + closestPair.pointB.x) / 2,
    y: (closestPair.pointA.y + closestPair.pointB.y) / 2,
  }
}

// Helper function to clamp a value between min and max
const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value))
}
