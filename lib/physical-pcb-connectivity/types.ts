import type { Point } from "@tscircuit/math-utils"
import type {
  LayerRef,
  PcbBreakoutPoint,
  PcbCopperPour,
  PcbGroundPlaneRegion,
  PcbPlatedHole,
  PcbPort,
  PcbSmtPad,
  PcbTrace,
  PcbVia,
} from "circuit-json"
import type { PadElement } from "lib/check-pad-clearance/common"

export type PcbTraceId = PcbTrace["pcb_trace_id"]
export type PcbPortId = PcbPort["pcb_port_id"]

type PcbPadId = PcbSmtPad["pcb_smtpad_id"] | PcbPlatedHole["pcb_plated_hole_id"]
type PcbViaId = PcbVia["pcb_via_id"]
type PcbCopperRegionId =
  | PcbCopperPour["pcb_copper_pour_id"]
  | PcbGroundPlaneRegion["pcb_ground_plane_region_id"]

export type TraceNodeId = `trace:${PcbTraceId}`
export type PortNodeId = `port:${PcbPortId}`
export type PadNodeId = `pad:${PcbPadId}`
export type ViaNodeId = `via:${PcbViaId}`
export type BreakoutNodeId =
  `breakout:${PcbBreakoutPoint["pcb_breakout_point_id"]}:${LayerRef}`
export type CopperRegionNodeId = `copper_region:${PcbCopperRegionId}`
export type PhysicalCopperNodeId =
  | TraceNodeId
  | PortNodeId
  | PadNodeId
  | ViaNodeId
  | BreakoutNodeId
  | CopperRegionNodeId

export type PhysicalCopperGroupId = PhysicalCopperNodeId

export type CopperRegionGeometry = {
  nodeId: CopperRegionNodeId
  layer: LayerRef
  points: Point[]
  pcbGroundPlaneId?: PcbGroundPlaneRegion["pcb_ground_plane_id"]
}

export const physicalContactToleranceMm = 0.001

export function getTraceNodeId(pcbTraceId: PcbTraceId): TraceNodeId {
  return `trace:${pcbTraceId}`
}

export function getPortNodeId(pcbPortId: PcbPortId): PortNodeId {
  return `port:${pcbPortId}`
}

export function getPadNodeId(pad: PadElement): PadNodeId {
  return pad.type === "pcb_smtpad"
    ? `pad:${pad.pcb_smtpad_id}`
    : `pad:${pad.pcb_plated_hole_id}`
}

export function getViaNodeId(pcbViaId: PcbViaId): ViaNodeId {
  return `via:${pcbViaId}`
}

export function getBreakoutNodeId({
  pcbBreakoutPointId,
  layer,
}: {
  pcbBreakoutPointId: PcbBreakoutPoint["pcb_breakout_point_id"]
  layer: LayerRef
}): BreakoutNodeId {
  return `breakout:${pcbBreakoutPointId}:${layer}`
}

export function getCopperRegionNodeId(
  region: PcbCopperPour | PcbGroundPlaneRegion,
): CopperRegionNodeId {
  return region.type === "pcb_copper_pour"
    ? `copper_region:${region.pcb_copper_pour_id}`
    : `copper_region:${region.pcb_ground_plane_region_id}`
}
