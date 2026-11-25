import { cju } from "@tscircuit/circuit-json-util"
import {
  all_layers,
  type AnyCircuitElement,
  type PcbTraceError,
} from "circuit-json"
import { getPcbTraceSelfShortLocation } from "./get-pcb-trace-self-short-location"
import { getPcbPortIdsConnectedToTraces } from "./check-each-pcb-trace-non-overlapping/getPcbPortIdsConnectedToTraces"

/** Detect copper contact that bypasses part of a length-matched route. */
export function checkPcbTraceSelfShorts(
  circuitJson: AnyCircuitElement[],
): PcbTraceError[] {
  const matchedSourceTraceIds = new Set(
    circuitJson.flatMap((element) =>
      element.type === "source_bus" && element.max_length_skew !== undefined
        ? element.source_trace_ids
        : [],
    ),
  )
  const db = cju(circuitJson)
  const board = circuitJson.find((e) => e.type === "pcb_board")
  const stack = [
    "top",
    ...all_layers
      .filter((layer) => layer.startsWith("inner"))
      .slice(0, board ? Math.max(0, board.num_layers - 2) : undefined),
    ...(board?.num_layers === 1 ? [] : ["bottom"]),
  ]
  const vias = db.pcb_via.list()
  const errors: PcbTraceError[] = []
  for (const trace of circuitJson) {
    if (trace.type !== "pcb_trace") continue
    if (
      !trace.source_trace_id ||
      !matchedSourceTraceIds.has(trace.source_trace_id)
    )
      continue

    const shortCenter = getPcbTraceSelfShortLocation(
      trace.route.map((point) => {
        if (point.route_type !== "via") return point
        const via = vias.find(
          (via) =>
            (via.pcb_trace_id === trace.pcb_trace_id ||
              (!via.pcb_trace_id &&
                via.source_trace_id === trace.source_trace_id)) &&
            Math.hypot(via.x - point.x, via.y - point.y) <= 1e-9,
        )
        const from = stack.indexOf(point.from_layer)
        const to = stack.indexOf(point.to_layer)
        return {
          ...point,
          outer_diameter: via?.outer_diameter ?? point.outer_diameter,
          layers:
            via?.layers ??
            (from >= 0 && to >= 0
              ? stack.slice(Math.min(from, to), Math.max(from, to) + 1)
              : []),
        }
      }),
    )
    if (shortCenter) {
      const sourceTrace = db.source_trace.get(trace.source_trace_id)
      const endpointNames = (sourceTrace?.connected_source_port_ids ?? [])
        .map((id) => {
          const port = db.source_port.get(id)
          const component = port?.source_component_id
            ? db.source_component.get(port.source_component_id)
            : undefined
          return component?.name && port?.name
            ? `${component.name}.${port.name}`
            : undefined
        })
        .filter((name): name is string => Boolean(name))
      const traceName =
        sourceTrace?.name ||
        sourceTrace?.display_name ||
        endpointNames.join(" → ") ||
        "unnamed"
      errors.push({
        type: "pcb_trace_error",
        error_type: "pcb_trace_error",
        pcb_trace_error_id: `self_short_${trace.pcb_trace_id}`,
        pcb_trace_id: trace.pcb_trace_id,
        source_trace_id: trace.source_trace_id,
        message: `PCB trace "${traceName}" shorts to itself, bypassing part of its length-matched route`,
        center: shortCenter,
        pcb_component_ids: [],
        pcb_port_ids: getPcbPortIdsConnectedToTraces([trace]),
        subcircuit_id: trace.subcircuit_id,
      })
    }
  }
  return errors
}
