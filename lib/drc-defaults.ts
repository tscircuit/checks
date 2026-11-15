import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type {
  AnyCircuitElement,
  ManufacturingDrcProperties,
  PcbBoard,
} from "circuit-json"

export const DEFAULT_TRACE_MARGIN = 0.1
export const DEFAULT_TRACE_THICKNESS = jlcMinTolerances.min_trace_width
export const DEFAULT_VIA_DIAMETER = jlcMinTolerances.min_via_pad_diameter
export const DEFAULT_VIA_BOARD_MARGIN =
  jlcMinTolerances.min_board_edge_clearance!

export const DEFAULT_SAME_NET_VIA_MARGIN =
  jlcMinTolerances.min_via_hole_edge_to_via_hole_edge_clearance!
export const DEFAULT_DIFFERENT_NET_VIA_MARGIN =
  jlcMinTolerances.min_via_hole_edge_to_via_hole_edge_clearance!

export const DEFAULT_PAD_PAD_CLEARANCE =
  jlcMinTolerances.min_pad_edge_to_pad_edge_clearance!

export const EPSILON = 0.005

export const getPcbBoard = (
  circuitJson: AnyCircuitElement[],
): PcbBoard | undefined =>
  circuitJson.find((el): el is PcbBoard => el.type === "pcb_board")

export const getBoardDrcValue = <K extends keyof ManufacturingDrcProperties>(
  board: PcbBoard | undefined,
  key: K,
): ManufacturingDrcProperties[K] => board?.[key]

/**
 * JLCPCB builds vias with a pad at least 0.1mm larger than the drill, i.e. a
 * 0.05mm annular ring (min_via_pad_diameter - min_via_hole_diameter) / 2.
 */
export const DEFAULT_MIN_VIA_ANNULAR_RING =
  (jlcMinTolerances.min_via_pad_diameter! -
    jlcMinTolerances.min_via_hole_diameter!) /
  2

/**
 * Smallest plated through-hole annular ring JLCPCB lists (1oz copper). Their
 * capabilities page also quotes 0.15mm and 0.25mm, so this only flags rings
 * that no listed process accepts.
 */
export const DEFAULT_MIN_PLATED_HOLE_ANNULAR_RING = 0.13
