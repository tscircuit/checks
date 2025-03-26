import { getBoundsOfPcbElements } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  PcbHole,
  PCBKeepout,
  PcbPlatedHole,
  PcbSmtPad,
  PcbTrace,
  PcbTraceError,
  PcbVia,
} from "circuit-json"

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type PcbTraceSegment = {
  type: "pcb_trace_segment"
  _pcbTrace: PcbTrace
  pcb_trace_id: string
  thickness: number
  layer: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export type Collidable =
  | PcbTraceSegment
  | PcbSmtPad
  | PcbPlatedHole
  | PcbHole
  | PcbVia
  | PCBKeepout

export const getCollidableBounds = (collidable: Collidable): Bounds => {
  if (collidable.type === "pcb_trace_segment") {
    return {
      minX: Math.min(collidable.x1, collidable.x2),
      minY: Math.min(collidable.y1, collidable.y2),
      maxX: Math.max(collidable.x1, collidable.x2),
      maxY: Math.max(collidable.y1, collidable.y2),
    }
  }
  return getBoundsOfPcbElements([collidable as any])
}
