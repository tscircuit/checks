import type {
  ConnectivityNetId,
  PcbTraceId,
  PcbViaId,
  PcbCopperLayer,
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
import { getPourContactTester } from "./pour-contact-index"
import { isPointInPad } from "../check-traces-are-contiguous/is-point-in-pad"
import { getLayersOfPcbElement } from "../util/getLayersOfPcbElement"

type ViaContact = {
  x: number
  y: number
  ownerTraceId?: PcbTraceId
  radius?: number
  holeRadius?: number
  touchesPadOrPour: boolean
  touchingTraceIds: Set<PcbTraceId>
}

type ViaContactIndex = Map<ConnectivityNetId, Map<PcbCopperLayer, ViaContact[]>>
const CONTACT_EPSILON = 1e-9

/** Index actual via copper independently of lateral trace segments. */
export function getViaContactIndex(
  circuitJson: AnyCircuitElement[],
  connectivity: ConnectivityMap,
): ViaContactIndex {
  const viaContactIndex: ViaContactIndex = new Map()
  const touchesPour = getPourContactTester(circuitJson, connectivity)
  const pads = getPads(circuitJson)
  const traces = circuitJson.filter((element) => element.type === "pcb_trace")
  const vias = circuitJson.filter((element) => element.type === "pcb_via")
  const board = circuitJson.find((element) => element.type === "pcb_board")
  const layerCount = board?.num_layers
  const innerLayers = all_layers.filter((layer) => layer.startsWith("inner"))
  let boardInnerLayers = innerLayers
  if (layerCount !== undefined) {
    boardInnerLayers = innerLayers.slice(0, Math.max(0, layerCount - 2))
  }
  const boardLayerStack = ["top", ...boardInnerLayers]
  if (layerCount !== 1) {
    boardLayerStack.push("bottom")
  }
  const addViaContact = (
    id: PcbTraceId | PcbViaId,
    layers: PcbCopperLayer[],
    contact: Omit<ViaContact, "touchesPadOrPour" | "touchingTraceIds">,
  ) => {
    if (![contact.x, contact.y].every(Number.isFinite)) return
    const net = connectivity.getNetConnectedToId(id)
    if (!net) return
    const touchesPadOrPour =
      touchesPour(
        net,
        layers,
        contact,
        contact.radius ?? 0,
        contact.holeRadius,
      ) ||
      pads.some((pad) => {
        if (
          connectivity.getNetConnectedToId(getPrimaryId(pad)) !== net ||
          !getLayersOfPcbElement(pad).some((layer) => layers.includes(layer))
        ) {
          return false
        }
        if (contact.radius === undefined) return isPointInPad(contact, pad)
        const viaGeometry = {
          type: "pcb_via",
          pcb_via_id: id,
          x: contact.x,
          y: contact.y,
          outer_diameter: contact.radius * 2,
          hole_diameter: 0,
          layers,
        } as PcbVia
        return getPadToPadGap(viaGeometry, pad) <= CONTACT_EPSILON
      })
    const touchingTraceIds = new Set<PcbTraceId>()
    for (const trace of traces) {
      if (
        trace.route_thickness_mode === "interpolated" ||
        connectivity.getNetConnectedToId(trace.pcb_trace_id) !== net
      ) {
        continue
      }
      for (let i = 1; i < trace.route.length; i++) {
        const segmentStart = trace.route[i - 1]!
        const segmentEnd = trace.route[i]!
        if (
          segmentStart.route_type !== "wire" ||
          segmentEnd.route_type !== "wire" ||
          segmentStart.layer !== segmentEnd.layer ||
          !layers.includes(segmentStart.layer) ||
          !Number.isFinite(segmentStart.width) ||
          segmentStart.width <= 0 ||
          Math.hypot(
            segmentStart.x - segmentEnd.x,
            segmentStart.y - segmentEnd.y,
          ) <= CONTACT_EPSILON
        ) {
          continue
        }
        let contactDistance = 0
        if (contact.radius !== undefined) {
          contactDistance = contact.radius + segmentStart.width / 2
        }
        if (
          pointToSegmentDistance(contact, segmentStart, segmentEnd) <=
          contactDistance + CONTACT_EPSILON
        ) {
          touchingTraceIds.add(trace.pcb_trace_id)
          break
        }
      }
    }
    const viaContact: ViaContact = {
      ...contact,
      touchesPadOrPour,
      touchingTraceIds,
    }
    const contactsByLayer =
      viaContactIndex.get(net) ?? new Map<PcbCopperLayer, ViaContact[]>()
    for (const layer of layers) {
      const contacts = contactsByLayer.get(layer) ?? []
      contacts.push(viaContact)
      contactsByLayer.set(layer, contacts)
    }
    viaContactIndex.set(net, contactsByLayer)
  }

  for (const via of vias) {
    if (!Number.isFinite(via.outer_diameter) || via.outer_diameter <= 0)
      continue
    addViaContact(via.pcb_via_id, getLayersOfPcbElement(via), {
      x: via.x,
      y: via.y,
      ownerTraceId: via.pcb_trace_id,
      radius: via.outer_diameter / 2,
      holeRadius: via.hole_diameter / 2,
    })
  }

  // Route-only inputs may not have materialized pcb_via records yet. Expand
  // their physical span using the board stack, including intermediate layers.
  for (const trace of circuitJson) {
    if (trace.type !== "pcb_trace") continue
    for (const point of trace.route) {
      if (point.route_type !== "via") continue
      if (
        vias.some(
          (via) =>
            Math.hypot(via.x - point.x, via.y - point.y) <= CONTACT_EPSILON &&
            (via.pcb_trace_id === trace.pcb_trace_id ||
              (!via.pcb_trace_id &&
                connectivity.areIdsConnected(
                  via.pcb_via_id,
                  trace.pcb_trace_id,
                ))),
        )
      ) {
        continue
      }
      const fromLayerIndex = boardLayerStack.indexOf(point.from_layer)
      const toLayerIndex = boardLayerStack.indexOf(point.to_layer)
      if (fromLayerIndex < 0 || toLayerIndex < 0) continue
      const diameter = point.outer_diameter
      if (
        diameter !== undefined &&
        (!Number.isFinite(diameter) || diameter <= 0)
      ) {
        continue
      }
      let radius: number | undefined
      if (diameter !== undefined) {
        radius = diameter / 2
      }
      addViaContact(
        trace.pcb_trace_id,
        boardLayerStack.slice(
          Math.min(fromLayerIndex, toLayerIndex),
          Math.max(fromLayerIndex, toLayerIndex) + 1,
        ),
        {
          x: point.x,
          y: point.y,
          ownerTraceId: trace.pcb_trace_id,
          radius,
        },
      )
    }
  }
  return viaContactIndex
}

export function endpointTouchesVia({
  point,
  width,
  ownerTrace,
  index,
  connectivity,
}: {
  point: PcbTrace["route"][number]
  width: number
  ownerTrace: PcbTrace
  index: ViaContactIndex
  connectivity: ConnectivityMap
}): boolean {
  if (point.route_type !== "wire" || !Number.isFinite(width) || width <= 0)
    return false
  const net = connectivity.getNetConnectedToId(ownerTrace.pcb_trace_id)
  if (!net) return false
  return (index.get(net)?.get(point.layer) ?? []).some((via) => {
    if (via.ownerTraceId === ownerTrace.pcb_trace_id) return false
    // A lone via does not establish an onward connection. Its barrel must
    // reach a same-net pad, pour, or another nondegenerate trace on a physical layer.
    if (
      !via.touchesPadOrPour &&
      ![...via.touchingTraceIds].some((id) => id !== ownerTrace.pcb_trace_id)
    ) {
      return false
    }
    // When a route-only via has no diameter, certify exact center contact only.
    let contactDistance = 0
    if (via.radius !== undefined) {
      contactDistance = via.radius + width / 2
    }
    return (
      Math.hypot(point.x - via.x, point.y - via.y) <=
      contactDistance + CONTACT_EPSILON
    )
  })
}
