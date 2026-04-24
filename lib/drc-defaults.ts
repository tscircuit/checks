import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"

export const DEFAULT_TRACE_MARGIN = 0.1
export const DEFAULT_TRACE_THICKNESS = jlcMinTolerances.min_trace_width
export const DEFAULT_VIA_DIAMETER = jlcMinTolerances.min_via_pad_diameter
export const DEFAULT_VIA_BOARD_MARGIN = 0.3

export const DEFAULT_SAME_NET_VIA_MARGIN =
  jlcMinTolerances.min_via_hole_edge_to_via_hole_edge_clearance
export const DEFAULT_DIFFERENT_NET_VIA_MARGIN =
  jlcMinTolerances.min_via_hole_edge_to_via_hole_edge_clearance

export const DEFAULT_PAD_PAD_CLEARANCE =
  jlcMinTolerances.min_pad_edge_to_pad_edge_clearance
export const DEFAULT_PAD_TRACE_CLEARANCE =
  jlcMinTolerances.min_trace_to_pad_edge_clearance

export const EPSILON = 0.005
