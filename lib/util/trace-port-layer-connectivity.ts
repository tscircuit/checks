import {
  all_layers,
  type AnyCircuitElement,
  type PcbBoard,
  type PcbPort,
  type PcbTrace,
  type PcbVia,
} from "circuit-json"
import { getPadToPadGap } from "../check-pad-clearance/common"
import { isPointInPad } from "../check-traces-are-contiguous/is-point-in-pad"
import { getBoardOwnerResolver } from "./get-board-owner-resolver"
import { getLayersOfPcbElement } from "./getLayersOfPcbElement"

type Wire = Extract<PcbTrace["route"][number], { route_type: "wire" }>
const EPSILON = 1e-9
const innerLayers = all_layers.filter((l) => l.startsWith("inner"))

const getStackForBoard = (board: PcbBoard | undefined): string[] => [
  "top",
  ...innerLayers.slice(
    0,
    board ? Math.max(0, board.num_layers - 2) : undefined,
  ),
  ...(board?.num_layers === 1 ? [] : ["bottom"]),
]

/** Endpoint IDs express intent, not a plated connection between copper layers. */
export function createTracePortLayerConnectivity(circuit: AnyCircuitElement[]) {
  const getBoardOwner = getBoardOwnerResolver(circuit)
  const defaultBoard = circuit.find(
    (e): e is PcbBoard => e.type === "pcb_board",
  )
  const boardsById = new Map<string, PcbBoard>(
    circuit.flatMap((e) =>
      e.type === "pcb_board" ? [[e.pcb_board_id, e] as const] : [],
    ),
  )
  const ports = new Map(
    circuit.filter((e) => e.type === "pcb_port").map((p) => [p.pcb_port_id, p]),
  )
  const pads = circuit.filter(
    (e) => e.type === "pcb_smtpad" || e.type === "pcb_plated_hole",
  )
  const padsByPort = new Map<string, typeof pads>()
  for (const pad of pads) {
    if (!pad.pcb_port_id) continue
    const entries = padsByPort.get(pad.pcb_port_id) ?? []
    entries.push(pad)
    padsByPort.set(pad.pcb_port_id, entries)
  }
  const emittedVias = circuit
    .filter((e): e is PcbVia => e.type === "pcb_via")
    .map((v) => ({ via: v, boardId: getBoardOwner(v) }))
  let bridges:
    | {
        x: number
        y: number
        layers: string[]
        diameter?: number
        boardId?: string
      }[]
    | undefined
  const getBridges = () => {
    if (bridges) return bridges
    bridges = emittedVias.map(({ via, boardId }) => ({
      ...via,
      diameter: via.outer_diameter,
      boardId,
    }))
    for (const trace of circuit) {
      if (trace.type !== "pcb_trace") continue
      const traceBoardId = getBoardOwner(trace)
      const board =
        (traceBoardId ? boardsById.get(traceBoardId) : undefined) ??
        defaultBoard
      const stack = getStackForBoard(board)
      for (const point of trace.route) {
        if (point.route_type !== "via") continue
        // An emitted barrel is authoritative: do not expand a blind/buried via
        // from a stale route-level declaration at the same position.
        if (
          emittedVias.some(
            ({ via: v, boardId: viaBoardId }) =>
              !(traceBoardId && viaBoardId && traceBoardId !== viaBoardId) &&
              Math.hypot(v.x - point.x, v.y - point.y) <= EPSILON,
          )
        )
          continue
        const from = stack.indexOf(point.from_layer),
          to = stack.indexOf(point.to_layer)
        if (from < 0 || to < 0) continue
        bridges.push({
          ...point,
          layers: stack.slice(Math.min(from, to), Math.max(from, to) + 1),
          diameter: point.outer_diameter,
          boardId: traceBoardId,
        })
      }
    }
    return bridges
  }
  const layersForPort = (port: PcbPort) => {
    const portPads = padsByPort.get(port.pcb_port_id)
    return portPads?.length
      ? [...new Set(portPads.flatMap(getLayersOfPcbElement))]
      : port.layers
  }
  const canConnect = (point: Wire, portId: string, traceBoardId?: string) => {
    const port = ports.get(portId)
    if (!port) return true // Missing port records are handled by other checks.
    const portBoardId = getBoardOwner(port)
    if (traceBoardId && portBoardId && traceBoardId !== portBoardId) {
      return false
    }
    const ownerBoardId = traceBoardId ?? portBoardId
    const layers = layersForPort(port)
    if (layers.includes(point.layer)) return true
    const portPads = padsByPort.get(portId) ?? []
    return getBridges().some((via) => {
      if (ownerBoardId && via.boardId && ownerBoardId !== via.boardId)
        return false
      if (
        !via.layers.includes(point.layer) ||
        !layers.some((l) => via.layers.includes(l))
      )
        return false
      if (
        via.diameter !== undefined &&
        (!Number.isFinite(via.diameter) || via.diameter <= 0)
      )
        return false
      // With no diameter, a route-only via certifies center contact only.
      const reach =
        via.diameter === undefined ? 0 : via.diameter / 2 + point.width / 2
      if (Math.hypot(point.x - via.x, point.y - via.y) > reach + EPSILON)
        return false
      if (portPads.length === 0)
        return Math.hypot(port.x - via.x, port.y - via.y) <= EPSILON
      return portPads.some((pad) => {
        if (!getLayersOfPcbElement(pad).some((l) => via.layers.includes(l)))
          return false
        if (via.diameter === undefined) return isPointInPad(via, pad)
        return (
          getPadToPadGap(
            {
              type: "pcb_via",
              pcb_via_id: "layer-contact",
              x: via.x,
              y: via.y,
              outer_diameter: via.diameter,
              hole_diameter: 0,
              layers: via.layers,
            } as PcbVia,
            pad,
          ) <= EPSILON
        )
      })
    })
  }
  return { ports, layersForPort, canConnect, getBoardOwner }
}

export function getTracePortLayerMismatches(circuit: AnyCircuitElement[]) {
  const contact = createTracePortLayerConnectivity(circuit)
  return circuit.flatMap((trace) => {
    if (trace.type !== "pcb_trace") return []
    const traceBoardId = contact.getBoardOwner(trace)
    return trace.route.flatMap((point, index) => {
      if (point.route_type !== "wire") return []
      return [
        ...new Set([point.start_pcb_port_id, point.end_pcb_port_id]),
      ].flatMap((portId) => {
        if (!portId || contact.canConnect(point, portId, traceBoardId))
          return []
        const port = contact.ports.get(portId)!
        return [
          { trace, point, index, port, padLayers: contact.layersForPort(port) },
        ]
      })
    })
  })
}
