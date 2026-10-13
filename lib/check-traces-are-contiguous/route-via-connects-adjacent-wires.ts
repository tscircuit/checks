import {
  all_layers,
  type AnyCircuitElement,
  type PcbTrace,
  type PcbVia,
} from "circuit-json"

type RoutePoint = PcbTrace["route"][number]
type WirePoint = Extract<RoutePoint, { route_type: "wire" }>
type ViaPoint = Extract<RoutePoint, { route_type: "via" }>
const CONTACT_EPSILON = 0.01

interface RouteViaContactContext {
  stack: string[]
  ownedViasByTrace: Map<string, PcbVia[]>
}

/** Build board/owned-barrel metadata once per continuity check. */
export function createRouteViaContactContext(
  circuitJson: AnyCircuitElement[],
): RouteViaContactContext {
  const board = circuitJson.find((element) => element.type === "pcb_board")
  const innerLayers = all_layers.filter((layer) => layer.startsWith("inner"))
  const stack = [
    "top",
    ...innerLayers.slice(
      0,
      board ? Math.max(0, board.num_layers - 2) : undefined,
    ),
    ...(board?.num_layers === 1 ? [] : ["bottom"]),
  ]
  const ownedViasByTrace = new Map<string, PcbVia[]>()
  for (const element of circuitJson) {
    if (element.type !== "pcb_via" || !element.pcb_trace_id) continue
    const ownedVias = ownedViasByTrace.get(element.pcb_trace_id)
    if (ownedVias) ownedVias.push(element)
    else ownedViasByTrace.set(element.pcb_trace_id, [element])
  }
  return { stack, ownedViasByTrace }
}

/** Compact edges run to/from the via; colocated contacts may tap its plated span. */
export function routeViaConnectsAdjacentWires({
  via,
  incoming,
  outgoing,
  traceId,
  context: { stack, ownedViasByTrace },
}: {
  via: ViaPoint
  incoming: WirePoint
  outgoing: WirePoint
  traceId: string
  context: RouteViaContactContext
}): boolean {
  const fromIndex = stack.indexOf(via.from_layer)
  const toIndex = stack.indexOf(via.to_layer)
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
          stack.slice(
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
    stack.includes(incoming.layer) &&
    stack.includes(outgoing.layer) &&
    spans.some(
      (layers) =>
        layers.includes(incoming.layer) && layers.includes(outgoing.layer),
    ) &&
    (incomingAtVia || incoming.layer === via.from_layer) &&
    (outgoingAtVia || outgoing.layer === via.to_layer)
  )
}
