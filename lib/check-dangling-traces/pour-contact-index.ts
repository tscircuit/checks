import {
  CONTACT_EPSILON_MM,
  type ConnectivityNetId,
  type PcbCopperLayer,
} from "./types"
import { Circle, Point, Polygon } from "@flatten-js/core"
import { getPourPolygon, getViaPolygon } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement, LayerRef } from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { createCopperPolygonContactTester } from "../copper-pour-connectivity/create-copper-polygon-contact-tester"

// Board XY coordinates in mm are scaled up before polygon operations.
const POLYGON_SCALE = 1e6

interface CopperContact {
  netId: ConnectivityNetId
  layers: PcbCopperLayer[]
  center: { x: number; y: number }
  radius: number
  holeRadius?: number
}

function getContactCopperPolygon({
  center,
  radius,
  holeRadius = 0,
}: CopperContact): Polygon {
  if (holeRadius > 0) {
    // A pour inside the drill hole does not touch the via's copper ring.
    return getViaPolygon(center, radius * 2, holeRadius * 2).scale(
      POLYGON_SCALE,
      POLYGON_SCALE,
    )
  }
  return new Polygon(
    new Circle(
      new Point(center.x * POLYGON_SCALE, center.y * POLYGON_SCALE),
      radius * POLYGON_SCALE,
    ),
  )
}

/** Tests contact against same-net pours, respecting pour holes and faces. */
export function getPourContactTester(
  circuitJson: AnyCircuitElement[],
  connMap: ConnectivityMap,
) {
  const pourPolygonsByNetId = new Map<
    ConnectivityNetId,
    { layer: LayerRef; polygon: Polygon }[]
  >()
  for (const pour of circuitJson) {
    if (pour.type !== "pcb_copper_pour" || !pour.source_net_id) continue
    const netId = connMap.getNetConnectedToId(pour.source_net_id)
    if (!netId) continue
    const pours = pourPolygonsByNetId.get(netId) ?? []
    pours.push({
      layer: pour.layer,
      polygon: getPourPolygon(pour).scale(POLYGON_SCALE, POLYGON_SCALE),
    })
    pourPolygonsByNetId.set(netId, pours)
  }
  const copperPolygonsTouch = createCopperPolygonContactTester(
    CONTACT_EPSILON_MM * POLYGON_SCALE,
  )

  return (contact: CopperContact) => {
    const pours = (pourPolygonsByNetId.get(contact.netId) ?? []).filter(
      (pour) => contact.layers.includes(pour.layer),
    )
    if (contact.radius === 0) {
      const contactPoint = new Point(
        contact.center.x * POLYGON_SCALE,
        contact.center.y * POLYGON_SCALE,
      )
      return pours.some((pour) => pour.polygon.contains(contactPoint))
    }
    if (pours.length === 0) return false
    const contactPolygon = getContactCopperPolygon(contact)
    return pours.some((pour) =>
      copperPolygonsTouch(contactPolygon, pour.polygon),
    )
  }
}
