import type {
  AnyCircuitElement,
  PcbKeepoutOverlapWarning,
  PcbPlacementError,
  Point,
} from "circuit-json"

export type RuleAreaTarget =
  | "component"
  | "footprint"
  | "pad"
  | "track"
  | "trace"
  | "via"
  | "zone"
  | "copper_pour"

export interface RuleAreaConstraint {
  type: "outside" | "disallow" | "inside"
  clearance?: number | string
}

export interface RuleAreaRule {
  id: string
  targets: RuleAreaTarget[]
  excludeOwner?: boolean
  excludeComponentClasses?: string[]
  excludeRefs?: string[]
  exceptNets?: string[]
  exceptNetClasses?: string[]
  constraint: RuleAreaConstraint
  severity?: "warning" | "error"
  description?: string
}

export interface RuleAreaInput {
  type?: "pcb_rule_area" | "pcb_keepout" | "source_rule_area"
  rule_area_id?: string
  pcb_rule_area_id?: string
  pcb_keepout_id?: string
  source_rule_area_id?: string
  name?: string
  description?: string
  shape?: "rect" | "circle" | "polygon" | "outline"
  center?: Point
  width?: number | string
  height?: number | string
  radius?: number | string
  points?: Point[]
  outline?: Point[]
  layers?: string[]
  pcb_component_id?: string
  source_component_id?: string
  is_world_coordinates?: boolean
  is_relative?: boolean
  rules: RuleAreaRule[]
  subcircuit_id?: string
}

export type PcbRuleArea = RuleAreaInput

export interface TransformedRuleArea {
  rule_area_id: string
  pcb_rule_area_id?: string
  pcb_keepout_id?: string
  name?: string
  description?: string
  pcb_component_id?: string
  source_component_id?: string
  layers: string[]
  shape: "circle" | "polygon"
  circle?: {
    center: Point
    radius: number
  }
  polygon?: Point[]
  rules: RuleAreaRule[]
  subcircuit_id?: string
}

export interface PcbRuleAreaViolationWarning extends PcbKeepoutOverlapWarning {
  type: "pcb_keepout_overlap_warning"
  warning_type: "pcb_keepout_overlap_warning"
  pcb_keepout_overlap_warning_id: string
  pcb_keepout_id: string
  rule_area_violation_id: string
  rule_area_id: string
  rule_id: string
  rule_area_name?: string
  pcb_rule_area_id?: string
  message: string
  layer?: string
  severity: "warning"
  offender_id?: string
  owner_id?: string
  center?: Point
  required_clearance?: number
  actual_clearance?: number
  pcb_component_ids?: string[]
  pcb_smtpad_ids?: string[]
  pcb_plated_hole_ids?: string[]
  pcb_trace_ids?: string[]
  pcb_via_ids?: string[]
  subcircuit_id?: string
}

export interface PcbRuleAreaViolationError extends PcbPlacementError {
  type: "pcb_placement_error"
  error_type: "pcb_placement_error"
  pcb_placement_error_id: string
  rule_area_violation_id: string
  rule_area_id: string
  rule_id: string
  rule_area_name?: string
  pcb_rule_area_id?: string
  message: string
  layer?: string
  severity: "error"
  offender_id?: string
  owner_id?: string
  center?: Point
  required_clearance?: number
  actual_clearance?: number
  pcb_component_ids?: string[]
  pcb_smtpad_ids?: string[]
  pcb_plated_hole_ids?: string[]
  pcb_trace_ids?: string[]
  pcb_via_ids?: string[]
  subcircuit_id?: string
}

export interface PcbMissingComponentGeometryError extends PcbPlacementError {
  type: "pcb_placement_error"
  error_type: "pcb_placement_error"
  pcb_placement_error_id: string
  message: string
  severity: "error"
  pcb_component_id: string
  rule_area_id: string
  rule_id?: string
  subcircuit_id?: string
}

export type RuleAreaDiagnostic =
  | PcbRuleAreaViolationWarning
  | PcbRuleAreaViolationError
  | PcbMissingComponentGeometryError
