import type { ConnectivityNetId, PcbCopperLayer } from "./types"
import { Circle, Point, Polygon } from "@flatten-js/core"
import { getPourPolygon, getViaPolygon } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement, LayerRef } from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { createCopperPolygonContactTester } from "../copper-pour-connectivity/create-copper-polygon-contact-tester"

const POLYGON_SCALE = 1e6
const CONTACT_EPSILON_MM = 1e-9

// Copper geometry uses board XY coordinates in mm before scaling.
function getContactCopperPolygon({
  center,
  radius,
  holeRadius,
}: {
  center: { x: number; y: number }
  radius: number
  holeRadius: number
}): Polygon {
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

/** Preserve pour holes and faces when testing copper contact. */
export function getPourContactTester(
  circuitJson: AnyCircuitElement[],
  connectivity: ConnectivityMap,
) {
  const pourPolygonsByNetId = new Map<
    ConnectivityNetId,
    { layer: LayerRef; polygon: Polygon }[]
  >()
  for (const pour of circuitJson) {
    if (pour.type !== "pcb_copper_pour" || !pour.source_net_id) continue
    const netId = connectivity.getNetConnectedToId(pour.source_net_id)
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
  return ({
    netId,
    layers,
    center,
    radius,
    holeRadius = 0,
  }: {
    netId: ConnectivityNetId
    layers: PcbCopperLayer[]
    center: { x: number; y: number }
    radius: number
    holeRadius?: number
  }) => {
    const pours = pourPolygonsByNetId.get(netId)
    if (!pours?.length) return false
    if (radius === 0) {
      const contactPoint = new Point(
        center.x * POLYGON_SCALE,
        center.y * POLYGON_SCALE,
      )
      return pours.some(
        (pour) =>
          layers.includes(pour.layer) && pour.polygon.contains(contactPoint),
      )
    }
    const copper = getContactCopperPolygon({ center, radius, holeRadius })
    return pours.some(
      (pour) =>
        layers.includes(pour.layer) &&
        copperPolygonsTouch(copper, pour.polygon),
    )
  }
}
