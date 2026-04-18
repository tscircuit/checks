import {
  cju,
  distanceBetweenCircleAndCircle,
  distanceBetweenCircleAndPolygon,
  distanceBetweenPolygonAndPolygon,
  getBoundsOfPcbElements,
} from "@tscircuit/circuit-json-util"
import { midpoint } from "@tscircuit/math-utils"
import type {
  AnyCircuitElement,
  PcbPlatedHole,
  PcbSmtPad,
  PcbTrace,
} from "circuit-json"
import type { PcbTraceSegment } from "lib/check-each-pcb-trace-non-overlapping/getCollidableBounds"
import type { Bounds } from "lib/data-structures/SpatialIndex"
import { DEFAULT_TRACE_THICKNESS } from "lib/drc-defaults"

export type PadElement = PcbSmtPad | PcbPlatedHole

export const formatMm = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000
  return `${Number(rounded.toFixed(3))}mm`
}

export const getPadBounds = (pad: PadElement): Bounds =>
  getBoundsOfPcbElements([pad])

export const getPadCenter = (pad: PadElement) => {
  const bounds = getPadBounds(pad)
  return midpoint(
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
  )
}

export const getPadRadius = (pad: PadElement) => {
  const bounds = getPadBounds(pad)
  return Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2
}

export const isCircularPad = (pad: PadElement) => pad.shape === "circle"

const getCircleShape = (pad: PadElement) => {
  const center = getPadCenter(pad)
  return {
    kind: "circle" as const,
    x: center.x,
    y: center.y,
    radius: getPadRadius(pad),
  }
}

const getPolygonShape = (pad: PadElement) => {
  const bounds = getPadBounds(pad)
  return {
    kind: "polygon" as const,
    points: [
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY },
    ],
  }
}

export const getPadToPadGap = (padA: PadElement, padB: PadElement) => {
  if (isCircularPad(padA) && isCircularPad(padB)) {
    return distanceBetweenCircleAndCircle(
      getCircleShape(padA),
      getCircleShape(padB),
    )
  }

  if (isCircularPad(padA)) {
    return distanceBetweenCircleAndPolygon(
      getCircleShape(padA),
      getPolygonShape(padB),
    )
  }

  if (isCircularPad(padB)) {
    return distanceBetweenCircleAndPolygon(
      getCircleShape(padB),
      getPolygonShape(padA),
    )
  }

  return distanceBetweenPolygonAndPolygon(
    getPolygonShape(padA),
    getPolygonShape(padB),
  )
}

export const getPads = (circuitJson: AnyCircuitElement[]) =>
  [
    ...cju(circuitJson).pcb_smtpad.list(),
    ...cju(circuitJson).pcb_plated_hole.list(),
  ] as PadElement[]

export const getTraceSegments = (
  circuitJson: AnyCircuitElement[],
): PcbTraceSegment[] => {
  const pcbTraces = cju(circuitJson).pcb_trace.list()

  return pcbTraces.flatMap((pcbTrace) => {
    const segments: PcbTraceSegment[] = []

    for (let i = 0; i < pcbTrace.route.length - 1; i++) {
      const p1 = pcbTrace.route[i]
      const p2 = pcbTrace.route[i + 1]
      if (p1.route_type !== "wire") continue
      if (p2.route_type !== "wire") continue
      if (p1.layer !== p2.layer) continue

      segments.push({
        type: "pcb_trace_segment",
        pcb_trace_id: pcbTrace.pcb_trace_id,
        _pcbTrace: pcbTrace as PcbTrace,
        thickness:
          "width" in p1
            ? p1.width
            : "width" in p2
              ? p2.width
              : DEFAULT_TRACE_THICKNESS,
        layer: p1.layer,
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
      })
    }

    return segments
  })
}
