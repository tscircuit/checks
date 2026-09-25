import {
  CONTACT_EPSILON_MM,
  type ConnectivityNetId,
  type PcbCopperLayer,
  type PcbTraceId,
  type PcbViaId,
} from "./types"
import {
  all_layers,
  type AnyCircuitElement,
  type PcbTrace,
  type PcbVia,
} from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { getPrimaryId } from "@tscircuit/circuit-json-util"
import { pointToSegmentDistance } from "@tscircuit/math-utils"
import { getPads, getPadToPadGap } from "../check-pad-clearance/common"
import type { getPourContactTester } from "./pour-contact-index"
import { isPointInPad } from "../check-traces-are-contiguous/is-point-in-pad"
import { getLayersOfPcbElement } from "../util/getLayersOfPcbElement"
import type { PcbTraceRoutePoint } from "../util/route-point-touches-pad"

/** Via copper in board XY coordinates (mm). */
interface ViaCopper {
  id: PcbTraceId | PcbViaId
  layers: PcbCopperLayer[]
  x: number
  y: number
  /** Route-only vias without a diameter can only prove exact center contact. */
  radius?: number
  holeRadius?: number
}

interface ViaContact {
  viaCopper: ViaCopper
  touchesPadOrPour: boolean
  touchingTraceIds: Set<PcbTraceId>
}

type ViaContactIndex = Map<ConnectivityNetId, Map<PcbCopperLayer, ViaContact[]>>

interface ViaContactContext {
  circuitJson: AnyCircuitElement[]
  connMap: ConnectivityMap
  touchesPour: ReturnType<typeof getPourContactTester>
}

function getBoardLayerStack(circuitJson: AnyCircuitElement[]) {
  const layerCount = circuitJson.find(
    (element) => element.type === "pcb_board",
  )?.num_layers
  let innerLayers = all_layers.filter((layer) => layer.startsWith("inner"))
  if (layerCount !== undefined) {
    innerLayers = innerLayers.slice(0, Math.max(0, layerCount - 2))
  }
  const boardLayerStack: string[] = ["top", ...innerLayers]
  if (layerCount !== 1) boardLayerStack.push("bottom")
  return boardLayerStack
}

function getPcbViaCoppers(vias: PcbVia[]): ViaCopper[] {
  return vias
    .filter(
      (via) => Number.isFinite(via.outer_diameter) && via.outer_diameter > 0,
    )
    .map((via) => ({
      id: via.pcb_via_id,
      layers: getLayersOfPcbElement(via),
      x: via.x,
      y: via.y,
      radius: via.outer_diameter / 2,
      holeRadius: via.hole_diameter / 2,
    }))
}

/**
 * Route-only inputs may not have materialized pcb_via records yet. Their
 * physical span covers every board layer between from_layer and to_layer.
 */
function getRouteViaCoppers(
  { traces, vias }: { traces: PcbTrace[]; vias: PcbVia[] },
  { circuitJson, connMap }: ViaContactContext,
): ViaCopper[] {
  const boardLayerStack = getBoardLayerStack(circuitJson)
  const viaCoppers: ViaCopper[] = []
  for (const trace of traces) {
    for (const point of trace.route) {
      if (point.route_type !== "via") continue
      const hasPcbVia = vias.some(
        (via) =>
          Math.hypot(via.x - point.x, via.y - point.y) <= CONTACT_EPSILON_MM &&
          (via.pcb_trace_id === trace.pcb_trace_id ||
            (!via.pcb_trace_id &&
              connMap.areIdsConnected(via.pcb_via_id, trace.pcb_trace_id))),
      )
      if (hasPcbVia) continue
      const fromLayerIndex = boardLayerStack.indexOf(point.from_layer)
      const toLayerIndex = boardLayerStack.indexOf(point.to_layer)
      if (fromLayerIndex < 0 || toLayerIndex < 0) continue
      const diameter = point.outer_diameter
      let radius: number | undefined
      if (diameter !== undefined) {
        if (!Number.isFinite(diameter) || diameter <= 0) continue
        radius = diameter / 2
      }
      viaCoppers.push({
        id: trace.pcb_trace_id,
        layers: boardLayerStack.slice(
          Math.min(fromLayerIndex, toLayerIndex),
          Math.max(fromLayerIndex, toLayerIndex) + 1,
        ),
        x: point.x,
        y: point.y,
        radius,
      })
    }
  }
  return viaCoppers
}

function viaTouchesPad({
  viaCopper,
  pad,
}: {
  viaCopper: ViaCopper
  pad: ReturnType<typeof getPads>[number]
}) {
  if (viaCopper.radius === undefined) return isPointInPad(viaCopper, pad)
  const viaGeometry: PcbVia = {
    type: "pcb_via",
    pcb_via_id: viaCopper.id,
    x: viaCopper.x,
    y: viaCopper.y,
    outer_diameter: viaCopper.radius * 2,
    hole_diameter: 0,
    layers: all_layers.filter((layer) => viaCopper.layers.includes(layer)),
  }
  return getPadToPadGap(viaGeometry, pad) <= CONTACT_EPSILON_MM
}

function traceTouchesVia({
  trace,
  viaCopper,
}: {
  trace: PcbTrace
  viaCopper: ViaCopper
}) {
  if (trace.route_thickness_mode === "interpolated") return false
  for (let i = 1; i < trace.route.length; i++) {
    const segmentStart = trace.route[i - 1]!
    const segmentEnd = trace.route[i]!
    if (
      segmentStart.route_type !== "wire" ||
      segmentEnd.route_type !== "wire" ||
      segmentStart.layer !== segmentEnd.layer ||
      !viaCopper.layers.includes(segmentStart.layer) ||
      !Number.isFinite(segmentStart.width) ||
      segmentStart.width <= 0 ||
      Math.hypot(
        segmentStart.x - segmentEnd.x,
        segmentStart.y - segmentEnd.y,
      ) <= CONTACT_EPSILON_MM
    ) {
      continue
    }
    let contactDistance = 0
    if (viaCopper.radius !== undefined) {
      contactDistance = viaCopper.radius + segmentStart.width / 2
    }
    if (
      pointToSegmentDistance(viaCopper, segmentStart, segmentEnd) <=
      contactDistance + CONTACT_EPSILON_MM
    ) {
      return true
    }
  }
  return false
}

/** Indexes via copper by net and layer, with the copper each via reaches. */
export function getViaContactIndex(ctx: ViaContactContext): ViaContactIndex {
  const { circuitJson, connMap, touchesPour } = ctx
  const pads = getPads(circuitJson)
  const traces = circuitJson.filter((element) => element.type === "pcb_trace")
  const vias = circuitJson.filter((element) => element.type === "pcb_via")
  const viaCoppers = [
    ...getPcbViaCoppers(vias),
    ...getRouteViaCoppers({ traces, vias }, ctx),
  ]
  const viaContactIndex: ViaContactIndex = new Map()

  for (const viaCopper of viaCoppers) {
    if (!Number.isFinite(viaCopper.x) || !Number.isFinite(viaCopper.y)) continue
    const netId = connMap.getNetConnectedToId(viaCopper.id)
    if (!netId) continue
    const touchesPadOrPour =
      touchesPour({
        netId,
        layers: viaCopper.layers,
        center: viaCopper,
        radius: viaCopper.radius ?? 0,
        holeRadius: viaCopper.holeRadius,
      }) ||
      pads.some(
        (pad) =>
          connMap.getNetConnectedToId(getPrimaryId(pad)) === netId &&
          getLayersOfPcbElement(pad).some((layer) =>
            viaCopper.layers.includes(layer),
          ) &&
          viaTouchesPad({ viaCopper, pad }),
      )
    const touchingTraceIds = new Set<PcbTraceId>()
    for (const trace of traces) {
      if (
        connMap.getNetConnectedToId(trace.pcb_trace_id) === netId &&
        traceTouchesVia({ trace, viaCopper })
      ) {
        touchingTraceIds.add(trace.pcb_trace_id)
      }
    }

    const viaContact: ViaContact = {
      viaCopper,
      touchesPadOrPour,
      touchingTraceIds,
    }
    const contactsByLayer =
      viaContactIndex.get(netId) ?? new Map<PcbCopperLayer, ViaContact[]>()
    for (const layer of viaCopper.layers) {
      const contacts = contactsByLayer.get(layer) ?? []
      contacts.push(viaContact)
      contactsByLayer.set(layer, contacts)
    }
    viaContactIndex.set(netId, contactsByLayer)
  }
  return viaContactIndex
}

/** A via connects an endpoint only when it also reaches other copper. */
export function endpointTouchesVia(
  {
    trace,
    point,
    width,
  }: {
    trace: PcbTrace
    point: Extract<PcbTraceRoutePoint, { route_type: "wire" }>
    width: number
  },
  {
    connMap,
    viaContactIndex,
  }: { connMap: ConnectivityMap; viaContactIndex: ViaContactIndex },
): boolean {
  if (!Number.isFinite(width) || width <= 0) return false
  const netId = connMap.getNetConnectedToId(trace.pcb_trace_id)
  if (!netId) return false
  const viaContacts = viaContactIndex.get(netId)?.get(point.layer) ?? []
  return viaContacts.some(
    ({ viaCopper, touchesPadOrPour, touchingTraceIds }) => {
      const hasOnwardConnection =
        touchesPadOrPour ||
        [...touchingTraceIds].some((traceId) => traceId !== trace.pcb_trace_id)
      if (!hasOnwardConnection) return false
      let contactDistance = 0
      if (viaCopper.radius !== undefined) {
        contactDistance = viaCopper.radius + width / 2
      }
      return (
        Math.hypot(point.x - viaCopper.x, point.y - viaCopper.y) <=
        contactDistance + CONTACT_EPSILON_MM
      )
    },
  )
}
