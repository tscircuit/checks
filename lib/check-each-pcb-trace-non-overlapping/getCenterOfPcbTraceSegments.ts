import type { PcbTraceSegment } from "./getCollidableBounds"

/**
 * Get the center point between two PCB trace segments
 */
export const getCenterOfPcbTraceSegments = (
  segmentA: PcbTraceSegment,
  segmentB: PcbTraceSegment,
) => {
  return {
    x:
      (Math.min(segmentA.x1, segmentA.x2, segmentB.x1, segmentB.x2) +
        Math.max(segmentA.x1, segmentA.x2, segmentB.x1, segmentB.x2)) /
      2,
    y:
      (Math.min(segmentA.y1, segmentA.y2, segmentB.y1, segmentB.y2) +
        Math.max(segmentA.y1, segmentA.y2, segmentB.y1, segmentB.y2)) /
      2,
  }
}
