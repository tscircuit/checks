import { Circle, Point, Polygon } from "@flatten-js/core"
import { getPourPolygon, getViaPolygon } from "@tscircuit/circuit-json-util"
import type { AnyCircuitElement, LayerRef, PcbTrace } from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { createCopperPolygonContactTester } from "../copper-pour-connectivity/create-copper-polygon-contact-tester"

type NetId = NonNullable<ReturnType<ConnectivityMap["getNetConnectedToId"]>>

/** Copper contact in right-handed board-world XY coordinates, +X right and
 * +Y up, in mm. Centers are points; their radius describes circular copper.
 * Retains pour holes and faces rather than treating its bounds as copper.
 */
export function getPourContactTester(
  circuitJson: AnyCircuitElement[],
  connectivity: ConnectivityMap,
) {
  const scale = 1e6
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
      polygon: getPourPolygon(pour).scale(scale, scale),
    })
    pourPolygonsByNetId.set(net, pours)
  }
  const copperPolygonsTouch = createCopperPolygonContactTester(1e-9 * scale)
  return (
    net: NetId,
    layers: string[],
    center: Pick<
      Extract<PcbTrace["route"][number], { route_type: "wire" }>,
      "x" | "y"
    >,
    radius: number,
    holeRadius = 0,
  ) => {
    const pours = pourPolygonsByNetId.get(net)
    if (!pours?.length) return false
    if (radius === 0) {
      const contactPoint = new Point(center.x * scale, center.y * scale)
      return pours.some(
        (pour) =>
          layers.includes(pour.layer) && pour.polygon.contains(contactPoint),
      )
    }
    const copper =
      holeRadius > 0
        ? getViaPolygon(center, radius * 2, holeRadius * 2).scale(scale, scale)
        : new Polygon(
            new Circle(
              new Point(center.x * scale, center.y * scale),
              radius * scale,
            ),
          )
    return pours.some(
      (pour) =>
        layers.includes(pour.layer) &&
        copperPolygonsTouch(copper, pour.polygon),
    )
  }
}
