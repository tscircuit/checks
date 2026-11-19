import { Point, type Polygon } from "@flatten-js/core"
import { getPlatedHolePolygon } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  PcbComponent,
  PcbPlatedHole,
  PcbPort,
  PcbSmtPad,
  PcbTrace,
} from "circuit-json"
import { isPointInPad } from "lib/check-traces-are-contiguous/is-point-in-pad"

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

function isPointWithinPlatedHoleMaxRadius(
  point: { x: number; y: number },
  hole: PcbPlatedHole,
): boolean {
  const dx = Math.abs(point.x - hole.x)
  const dy = Math.abs(point.y - hole.y)
  if (hole.shape === "circle") {
    const r = hole.outer_diameter / 2 + 1e-6
    return dx <= r && dy <= r
  }
  if ("outer_width" in hole) {
    const r = Math.hypot(hole.outer_width, hole.outer_height) / 2 + 1e-6
    return dx <= r && dy <= r
  }
  if ("rect_pad_width" in hole) {
    const r = Math.hypot(hole.rect_pad_width, hole.rect_pad_height) / 2 + 1e-6
    return dx <= r && dy <= r
  }
  if (hole.shape === "hole_with_polygon_pad") {
    let maxSq = 0
    for (const p of hole.pad_outline) {
      const sq = p.x * p.x + p.y * p.y
      if (sq > maxSq) maxSq = sq
    }
    const r = Math.sqrt(maxSq) + 1e-6
    return dx <= r && dy <= r
  }
  return true
}

/**
 * HACK: this whole method and all usage of it is a hack because of this issue:
 * https://github.com/tscircuit/tscircuit/issues/291
 */
export const addStartAndEndPortIdsIfMissing = (
  soup: AnyCircuitElement[],
): void => {
  const pcbPorts: PcbPort[] = soup.filter((item) => item.type === "pcb_port")
  const pcbSmtPads: PcbSmtPad[] = soup.filter(
    (item) => item.type === "pcb_smtpad",
  )
  const pcbPlatedHoles: PcbPlatedHole[] = soup.filter(
    (item) => item.type === "pcb_plated_hole",
  )
  const pcbTraces: PcbTrace[] = soup.filter((item) => item.type === "pcb_trace")
  let componentsById: Map<string, PcbComponent> | undefined
  const platedHolePolygons = new Map<PcbPlatedHole, Polygon>()

  const getCachedPlatedHolePolygon = (hole: PcbPlatedHole): Polygon => {
    let polygon = platedHolePolygons.get(hole)
    if (!polygon) {
      componentsById ??= new Map(
        soup
          .filter((item): item is PcbComponent => item.type === "pcb_component")
          .map((comp) => [comp.pcb_component_id, comp]),
      )
      const normalizedHole = {
        ...hole,
        hole_offset_x: "hole_offset_x" in hole ? (hole.hole_offset_x ?? 0) : 0,
        hole_offset_y: "hole_offset_y" in hole ? (hole.hole_offset_y ?? 0) : 0,
      }
      const componentRotation = hole.pcb_component_id
        ? componentsById.get(hole.pcb_component_id)?.rotation
        : 0
      polygon = getPlatedHolePolygon(normalizedHole, componentRotation)
      platedHolePolygons.set(hole, polygon)
    }
    return polygon
  }

  function findPortIdOverlappingPoint(
    point: {
      x: number
      y: number
      layer: PcbPort["layers"][number]
    },
    options: { isFirstOrLastPoint?: boolean; traceWidth?: number } = {},
  ): string | null {
    const traceWidth = options.traceWidth || 0
    const directPort = pcbPorts.find(
      (port) =>
        port.layers.includes(point.layer) &&
        distance(port.x, port.y, point.x, point.y) < 0.01,
    )
    if (directPort) return directPort.pcb_port_id

    // If it starts or ends inside an smtpad or plated hole annulus, connect it to the port
    if (options.isFirstOrLastPoint) {
      const smtPad = pcbSmtPads.find((pad) => {
        if (!pad.pcb_port_id || pad.layer !== point.layer) return false
        if (pad.shape === "rect") {
          return (
            (Math.abs(point.x - pad.x) < pad.width / 2 + traceWidth / 2 &&
              Math.abs(point.y - pad.y) < pad.height / 2 + traceWidth / 2) ||
            isPointInPad(point, pad)
          )
        }
        return isPointInPad(point, pad)
      })
      if (smtPad?.pcb_port_id) return smtPad.pcb_port_id

      const platedHole = pcbPlatedHoles.find((hole) => {
        if (!hole.pcb_port_id || !hole.layers.includes(point.layer)) {
          return false
        }
        if (!isPointWithinPlatedHoleMaxRadius(point, hole)) {
          return false
        }
        if (hole.shape === "circle") {
          const dx = point.x - hole.x
          const dy = point.y - hole.y
          const distSq = dx * dx + dy * dy
          const outerR = hole.outer_diameter / 2
          const innerR = hole.hole_diameter / 2
          return (
            distSq <= outerR * outerR + 1e-9 && distSq >= innerR * innerR - 1e-9
          )
        }
        const polygon = getCachedPlatedHolePolygon(hole)
        if (polygon.isEmpty()) return false
        const box = polygon.box
        if (
          point.x < box.xmin - 1e-9 ||
          point.x > box.xmax + 1e-9 ||
          point.y < box.ymin - 1e-9 ||
          point.y > box.ymax + 1e-9
        ) {
          return false
        }
        return polygon.contains(new Point(point.x, point.y))
      })
      if (platedHole?.pcb_port_id) return platedHole.pcb_port_id
    }

    return null
  }

  // Add start_pcb_port_id and end_pcb_port_id if not present
  for (const trace of pcbTraces) {
    for (let index = 0; index < trace.route.length; index++) {
      const segment = trace.route[index]
      const isFirstOrLastPoint = index === 0 || index === trace.route.length - 1
      if (segment.route_type === "wire") {
        if (!segment.start_pcb_port_id && index === 0) {
          const startPortId = findPortIdOverlappingPoint(segment, {
            isFirstOrLastPoint,
            traceWidth: segment.width,
          })
          if (startPortId) {
            segment.start_pcb_port_id = startPortId
          }
        }
        if (!segment.end_pcb_port_id && index === trace.route.length - 1) {
          const endPortId = findPortIdOverlappingPoint(segment, {
            isFirstOrLastPoint,
            traceWidth: segment.width,
          })
          if (endPortId) {
            segment.end_pcb_port_id = endPortId
          }
        }
      }
    }
  }
}
