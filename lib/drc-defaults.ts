import type {
  AnyCircuitElement,
  ManufacturingDrcProperties,
} from "circuit-json"

export const DEFAULT_TRACE_MARGIN = 0.1
export const DEFAULT_TRACE_THICKNESS = 0.1
export const DEFAULT_VIA_DIAMETER = 0.3
export const DEFAULT_VIA_BOARD_MARGIN = 0.3

export const DEFAULT_SAME_NET_VIA_MARGIN = 0.1
export const DEFAULT_DIFFERENT_NET_VIA_MARGIN = 0.1

export const DEFAULT_PAD_PAD_CLEARANCE = 0.1
export const DEFAULT_PAD_TRACE_CLEARANCE = 0.1

export const EPSILON = 0.005

export type BoardDrcPropertyKey = keyof ManufacturingDrcProperties

export const getBoardDrcValue = (
  circuitJson: AnyCircuitElement[],
  key: BoardDrcPropertyKey,
  fallback: number,
): number => {
  const board = circuitJson.find(
    (element): element is AnyCircuitElement & ManufacturingDrcProperties =>
      element.type === "pcb_board",
  )

  const value = board?.[key]
  return typeof value === "number" ? value : fallback
}
