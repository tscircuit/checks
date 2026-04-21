import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"

export const DEFAULT_TRACE_MARGIN = jlcMinTolerances.min_trace_width ?? 0.1
export const DEFAULT_TRACE_THICKNESS = jlcMinTolerances.min_trace_width ?? 0.15
export const DEFAULT_VIA_DIAMETER = jlcMinTolerances.min_via_pad_diameter ?? 0.6
export const DEFAULT_VIA_BOARD_MARGIN = 0.3

export const DEFAULT_SAME_NET_VIA_MARGIN =
  jlcMinTolerances.min_via_to_via_spacing ?? 0.2
export const DEFAULT_DIFFERENT_NET_VIA_MARGIN =
  jlcMinTolerances.min_via_to_via_spacing ?? 0.3

export const DEFAULT_PAD_PAD_CLEARANCE =
  jlcMinTolerances.min_pad_to_pad_spacing ?? 0.1
export const DEFAULT_PAD_TRACE_CLEARANCE =
  jlcMinTolerances.min_trace_to_pad_spacing ?? 0.1

export const EPSILON = 0.005
