import type { PcbPort, PcbTrace } from "circuit-json"
import {
  routePointTouchesPad,
  type PcbPad,
  type PcbTraceRoutePoint,
} from "../util/route-point-touches-pad"
import { distance } from "../util/distance"
import { getPcbPortIdsConnectedToRoutePoint } from "../check-each-pcb-trace-non-overlapping/getPcbPortIdsConnectedToTraces"

type PcbPortId = PcbPort["pcb_port_id"]
type WireRoutePoint = Extract<PcbTraceRoutePoint, { route_type: "wire" }>

function getRoutePointCenter(point: PcbTraceRoutePoint) {
  if (point.route_type === "through_pad") {
    return {
      x: (point.start.x + point.end.x) / 2,
      y: (point.start.y + point.end.y) / 2,
    }
  }

  return { x: point.x, y: point.y }
}

function routePointConnectsToAnotherExpectedPort({
  point,
  expectedPorts,
  missingPcbPortId,
  padMap,
}: {
  point: PcbTraceRoutePoint
  expectedPorts: PcbPort[]
  missingPcbPortId: PcbPortId
  padMap: Map<PcbPortId, PcbPad[]>
}) {
  return expectedPorts.some((expectedPort) => {
    if (
      !expectedPort.pcb_port_id ||
      expectedPort.pcb_port_id === missingPcbPortId
    ) {
      return false
    }

    const expectedPads = padMap.get(expectedPort.pcb_port_id)
    return (
      expectedPads?.some((pad) => routePointTouchesPad(point, pad)) ?? false
    )
  })
}

export function getMissingConnectionErrorCenter({
  firstPoint,
  lastPoint,
  port,
  expectedPorts,
  padMap,
}: {
  firstPoint: PcbTrace["route"][number]
  lastPoint: PcbTrace["route"][number]
  port: PcbPort
  expectedPorts: PcbPort[]
  padMap: Map<PcbPortId, PcbPad[]>
}) {
  let errorLocation: WireRoutePoint | undefined
  let firstWirePoint: WireRoutePoint | undefined
  let lastWirePoint: WireRoutePoint | undefined
  if (firstPoint.route_type === "wire") firstWirePoint = firstPoint
  if (lastPoint.route_type === "wire") lastWirePoint = lastPoint
  const firstWirePointReferencesPort = getPcbPortIdsConnectedToRoutePoint(
    firstPoint,
  ).includes(port.pcb_port_id)
  const lastWirePointReferencesPort = getPcbPortIdsConnectedToRoutePoint(
    lastPoint,
  ).includes(port.pcb_port_id)

  if (firstWirePointReferencesPort && firstWirePoint) {
    errorLocation = firstWirePoint
  } else if (lastWirePointReferencesPort && lastWirePoint) {
    errorLocation = lastWirePoint
  } else if (
    routePointConnectsToAnotherExpectedPort({
      point: firstPoint,
      expectedPorts,
      missingPcbPortId: port.pcb_port_id,
      padMap,
    }) &&
    lastWirePoint
  ) {
    errorLocation = lastWirePoint
  } else if (
    routePointConnectsToAnotherExpectedPort({
      point: lastPoint,
      expectedPorts,
      missingPcbPortId: port.pcb_port_id,
      padMap,
    }) &&
    firstWirePoint
  ) {
    errorLocation = firstWirePoint
  } else if (firstWirePoint && lastWirePoint) {
    if (distance(firstWirePoint, port) <= distance(lastWirePoint, port)) {
      errorLocation = firstWirePoint
    } else {
      errorLocation = lastWirePoint
    }
  } else if (firstWirePoint) {
    errorLocation = firstWirePoint
  } else if (lastWirePoint) {
    errorLocation = lastWirePoint
  }

  const firstPointCenter = getRoutePointCenter(firstPoint)
  const lastPointCenter = getRoutePointCenter(lastPoint)

  if (errorLocation) return { x: errorLocation.x, y: errorLocation.y }

  return {
    x: (firstPointCenter.x + lastPointCenter.x) / 2,
    y: (firstPointCenter.y + lastPointCenter.y) / 2,
  }
}
