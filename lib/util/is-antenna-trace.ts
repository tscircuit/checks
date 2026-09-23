import type { AnyCircuitElement, PcbTrace, SourcePort } from "circuit-json"

function isAntennaFeedPort(port: SourcePort): boolean {
  return (
    port.port_hints?.some((hint) => hint === "feed" || hint === "feed1") ??
    false
  )
}

/** Infer radiator ownership from core's existing feed aliases and path naming.
 * Endpoint positions are board-world points in mm, +X right, +Y up,
 * +Z above (right-handed). Only compare points on the same copper layer.
 */
export function isAntennaTrace(
  trace: PcbTrace,
  circuitJson: AnyCircuitElement[],
): boolean {
  const feedPorts = circuitJson.filter(
    (element): element is SourcePort =>
      element.type === "source_port" && isAntennaFeedPort(element),
  )

  // Generated antenna copper belongs to the footprint, unlike routed feeds.
  if (trace.pcb_component_id) {
    const pcbComponent = circuitJson.find(
      (element) =>
        element.type === "pcb_component" &&
        element.pcb_component_id === trace.pcb_component_id,
    )
    if (
      pcbComponent?.type === "pcb_component" &&
      feedPorts.some(
        (port) => port.source_component_id === pcbComponent.source_component_id,
      )
    )
      return true
  }

  const sourceTrace = circuitJson.find(
    (element) =>
      element.type === "source_trace" &&
      element.source_trace_id === trace.source_trace_id,
  )
  if (sourceTrace?.type !== "source_trace") return false

  for (const feedPort of feedPorts) {
    if (
      !sourceTrace.connected_source_port_ids.includes(feedPort.source_port_id)
    )
      continue
    const antenna = circuitJson.find(
      (element) =>
        element.type === "source_component" &&
        element.source_component_id === feedPort.source_component_id,
    )
    if (
      antenna?.type !== "source_component" ||
      sourceTrace.name !== `${antenna.name}_pcb_path`
    )
      continue

    // Shared source IDs must not exempt branches away from the antenna feed.
    const start = trace.route[0]
    if (start?.route_type !== "wire") continue
    if (
      circuitJson.some(
        (element) =>
          element.type === "pcb_port" &&
          element.source_port_id === feedPort.source_port_id &&
          element.layers.includes(start.layer) &&
          Math.hypot(element.x - start.x, element.y - start.y) <= 1e-9,
      )
    )
      return true
  }
  return false
}
