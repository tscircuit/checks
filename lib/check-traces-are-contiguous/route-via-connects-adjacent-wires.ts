import {
  all_layers,
  type AnyCircuitElement,
  type PcbBoard,
  type PcbTrace,
  type PcbVia,
} from "circuit-json"
import { getBoardOwnerResolver } from "../util/get-board-owner-resolver"

type RoutePoint = PcbTrace["route"][number]
type WirePoint = Extract<RoutePoint, { route_type: "wire" }>
type ViaPoint = Extract<RoutePoint, { route_type: "via" }>
const CONTACT_EPSILON = 0.01

interface RouteViaContactContext {
  stack: string[]
  stackByTraceId: Map<string, string[]>
  ownedViasByTrace: Map<string, PcbVia[]>
}

const innerLayers = all_layers.filter((layer) => layer.startsWith("inner"))

const getStackForBoard = (board: PcbBoard | undefined): string[] => [
  "top",
  ...innerLayers.slice(
    0,
    board ? Math.max(0, board.num_layers - 2) : undefined,
  ),
  ...(board?.num_layers === 1 ? [] : ["bottom"]),
]

/** Build board/owned-barrel metadata once per continuity check. */
export function createRouteViaContactContext(
  circuitJson: AnyCircuitElement[],
): RouteViaContactContext {
  const defaultBoard = circuitJson.find(
    (element): element is PcbBoard => element.type === "pcb_board",
  )
  const boardsById = new Map<string, PcbBoard>(
    circuitJson.flatMap((element) =>
      element.type === "pcb_board"
        ? [[element.pcb_board_id, element] as const]
        : [],
    ),
  )
  const getBoardOwner = getBoardOwnerResolver(circuitJson)
  const stack = getStackForBoard(defaultBoard)
  const stackByTraceId = new Map<string, string[]>()
  const traceBoardById = new Map<string, string | undefined>()
  for (const element of circuitJson) {
    if (element.type !== "pcb_trace") continue
    const boardId = getBoardOwner(element)
    traceBoardById.set(element.pcb_trace_id, boardId)
    const board =
      (boardId ? boardsById.get(boardId) : undefined) ?? defaultBoard
    stackByTraceId.set(element.pcb_trace_id, getStackForBoard(board))
  }
  const ownedViasByTrace = new Map<string, PcbVia[]>()
  for (const element of circuitJson) {
    if (element.type !== "pcb_via" || !element.pcb_trace_id) continue
    const viaBoardId = getBoardOwner(element)
    const traceBoardId = traceBoardById.get(element.pcb_trace_id)
    if (viaBoardId && traceBoardId && viaBoardId !== traceBoardId) continue
    const ownedVias = ownedViasByTrace.get(element.pcb_trace_id)
    if (ownedVias) ownedVias.push(element)
    else ownedViasByTrace.set(element.pcb_trace_id, [element])
  }
  return { stack, stackByTraceId, ownedViasByTrace }
}

/** Compact edges run to/from the via; colocated contacts may tap its plated span. */
export function routeViaConnectsAdjacentWires({
  via,
  incoming,
  outgoing,
  traceId,
  context: { stack, stackByTraceId, ownedViasByTrace },
}: {
  via: ViaPoint
  incoming: WirePoint
  outgoing: WirePoint
  traceId: string
  context: RouteViaContactContext
}): boolean {
  const activeStack = stackByTraceId?.get(traceId) ?? stack
  const fromIndex = activeStack.indexOf(via.from_layer)
  const toIndex = activeStack.indexOf(via.to_layer)
  if (fromIndex < 0 || toIndex < 0) return false
  // Materialized barrels are authoritative over stale route-span metadata.
  // Test coincident barrels separately; combining their layers can hide gaps.
  const emitted =
    ownedViasByTrace
      .get(traceId)
      ?.filter(
        (element) =>
          Math.abs(element.x - via.x) < CONTACT_EPSILON &&
          Math.abs(element.y - via.y) < CONTACT_EPSILON,
      ) ?? []
  const spans =
    emitted.length > 0
      ? emitted.map((element) => element.layers)
      : [
          activeStack.slice(
            Math.min(fromIndex, toIndex),
            Math.max(fromIndex, toIndex) + 1,
          ),
        ]
  const incomingAtVia =
    Math.abs(incoming.x - via.x) < CONTACT_EPSILON &&
    Math.abs(incoming.y - via.y) < CONTACT_EPSILON
  const outgoingAtVia =
    Math.abs(outgoing.x - via.x) < CONTACT_EPSILON &&
    Math.abs(outgoing.y - via.y) < CONTACT_EPSILON
  return (
    activeStack.includes(incoming.layer) &&
    activeStack.includes(outgoing.layer) &&
    spans.some(
      (layers) =>
        layers.includes(incoming.layer) && layers.includes(outgoing.layer),
    ) &&
    (incomingAtVia || incoming.layer === via.from_layer) &&
    (outgoingAtVia || outgoing.layer === via.to_layer)
  )
}
