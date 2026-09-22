import { Circle, Point, Polygon } from "@flatten-js/core"
import { getPourPolygon, getViaPolygon } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement, LayerRef, PcbTrace } from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { createCopperPolygonContactTester } from "../copper-pour-connectivity/create-copper-polygon-contact-tester"

const POLYGON_SCALE = 1e6
const CONTACT_EPSILON_MM = 1e-9

type NetId = NonNullable<ReturnType<ConnectivityMap["getNetConnectedToId"]>>

/** Copper contact in right-handed board-world XY coordinates, +X right and
 * +Y up, in mm. Centers are points; their radius describes circular copper.
 * Retains pour holes and faces rather than treating its bounds as copper.
 */
export function getPourContactTester(
  circuitJson: AnyCircuitElement[],
  connectivity: ConnectivityMap,
) {
  const pourPolygonsByNetId = new Map<
    NetId,
    { layer: LayerRef; polygon: Polygon }[]
  >()
  for (const pour of circuitJson) {
    if (pour.type !== "pcb_copper_pour" || !pour.source_net_id) continue
    const net = connectivity.getNetConnectedToId(pour.source_net_id)
    if (!net) continue
    const pours = pourPolygonsByNetId.get(net) ?? []
    pours.push({
      layer: pour.layer,
      polygon: getPourPolygon(pour).scale(POLYGON_SCALE, POLYGON_SCALE),
    })
    pourPolygonsByNetId.set(net, pours)
  }
  const copperPolygonsTouch = createCopperPolygonContactTester(
    CONTACT_EPSILON_MM * POLYGON_SCALE,
  )
  return function copperTouchesPour(
    net: NetId,
    layers: string[],
    center: Pick<
      Extract<PcbTrace["route"][number], { route_type: "wire" }>,
      "x" | "y"
    >,
    radius: number,
    holeRadius = 0,
  ) {
    const pours = pourPolygonsByNetId.get(net)
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
    let copper: Polygon
    if (holeRadius > 0) {
      // A pour inside the drill hole does not touch the via's copper ring.
      copper = getViaPolygon(center, radius * 2, holeRadius * 2).scale(
        POLYGON_SCALE,
        POLYGON_SCALE,
      )
    } else {
      copper = new Polygon(
        new Circle(
          new Point(center.x * POLYGON_SCALE, center.y * POLYGON_SCALE),
          radius * POLYGON_SCALE,
        ),
      )
    }
    return pours.some(
      (pour) =>
        layers.includes(pour.layer) &&
        copperPolygonsTouch(copper, pour.polygon),
    )
  }
}
