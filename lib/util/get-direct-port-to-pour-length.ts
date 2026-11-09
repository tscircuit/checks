import type { AnyCircuitElement, PcbTrace, SourceTrace } from "circuit-json"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { getPourContactTester } from "../check-dangling-traces/pour-contact-index"

/** Measures a direct port-to-plane drop in board-world XY mm (+X right, +Y up).
 * A single-layer wire must start at the actual source port and end at an emitted
 * via whose annulus touches the requested net's actual filled pour. Pour holes,
 * via layer spans and drill holes are respected. The full 1.6 mm via allowance
 * matches getPcbTraceLength; it is conservative for an internal plane.
 * Other route shapes remain subject to the ordinary aggregate length check.
 */
export function createDirectPortToPourLengthMeasurer(
  circuit: AnyCircuitElement[],
) {
  const connectivity = getFullConnectivityMapFromCircuitJson(circuit)
  const touchesPour = getPourContactTester(circuit, connectivity)
  const ports = circuit.filter((element) => element.type === "pcb_port")
  const vias = circuit.filter((element) => element.type === "pcb_via")
  return (source: SourceTrace, traces: PcbTrace[]): number | undefined => {
    if (
      source.connected_source_port_ids.length !== 1 ||
      source.connected_source_net_ids.length === 0
    )
      return
    const netId = connectivity.getNetConnectedToId(source.source_trace_id)
    if (
      !netId ||
      source.connected_source_net_ids.some(
        (id) => connectivity.getNetConnectedToId(id) !== netId,
      )
    )
      return
    const sourcePorts = ports.filter(
      (port) => port.source_port_id === source.connected_source_port_ids[0],
    )
    let shortest = Infinity
    for (const trace of traces) {
      const route =
        trace.route[0]?.route_type === "via"
          ? [...trace.route].reverse()
          : trace.route
      const start = route[0],
        terminal = route.at(-1)
      if (start?.route_type !== "wire" || terminal?.route_type !== "via")
        continue
      if (
        !sourcePorts.some(
          (port) =>
            port.layers.includes(start.layer) &&
            Math.hypot(port.x - start.x, port.y - start.y) < 1e-6,
        )
      )
        continue
      const wires = route.slice(0, -1)
      if (
        !wires.every(
          (point) => point.route_type === "wire" && point.layer === start.layer,
        )
      )
        continue
      const lastWire = wires.at(-1)!
      if (
        lastWire.route_type !== "wire" ||
        Math.hypot(lastWire.x - terminal.x, lastWire.y - terminal.y) > 1e-6
      )
        continue
      const via = vias.find(
        (via) =>
          Math.hypot(via.x - terminal.x, via.y - terminal.y) < 1e-6 &&
          via.layers.includes(start.layer) &&
          via.layers.includes(terminal.from_layer) &&
          via.layers.includes(terminal.to_layer) &&
          via.outer_diameter > via.hole_diameter &&
          connectivity.getNetConnectedToId(via.pcb_via_id) === netId &&
          touchesPour({
            netId,
            layers: via.layers.filter((layer) => layer !== start.layer),
            center: via,
            radius: via.outer_diameter / 2,
            holeRadius: via.hole_diameter / 2,
          }),
      )
      if (!via) continue
      let length = 1.6
      for (let i = 1; i < wires.length; i++) {
        const a = wires[i - 1],
          b = wires[i]
        if (a.route_type !== "wire" || b.route_type !== "wire") continue
        length += Math.hypot(b.x - a.x, b.y - a.y)
      }
      shortest = Math.min(shortest, length)
    }
    return Number.isFinite(shortest) ? shortest : undefined
  }
}
