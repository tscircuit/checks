import Flatbush from "flatbush"
import {
  pcb_bus_routing_constraint_error,
  pcb_bus_routing_constraint_warning,
} from "circuit-json"
import type {
  AnyCircuitElement,
  PcbBusRoutingConstraintError,
  PcbBusRoutingConstraintViolation,
  PcbBusRoutingConstraintWarning,
  SourceBus,
  SourceBusRouteLength,
  SourceBusTraceSpacing,
  SourceTrace,
  PcbTrace,
} from "circuit-json"
import { getReadableNameForElementId } from "./util/get-readable-names"
import {
  measureRoute,
  type RouteMeasurement,
  type RouteSegment,
} from "./util/measure-route"
import { capsuleIntervals, segmentSeparation } from "./util/check-route-spacing"

const EPS = 1e-8
export const hasSourceBusRoutingConstraints = (bus: SourceBus) =>
  [
    bus.length_match_source_trace_ids,
    bus.min_length,
    bus.max_length,
    bus.target_length,
    bus.length_tolerance,
    bus.pcb_trace_spacing,
    bus.pcb_spacing_to_other_signals,
    bus.target_impedance_min,
    bus.target_impedance_max,
    bus.target_differential_impedance_min,
    bus.target_differential_impedance_max,
  ].some((v) => v !== undefined)

type Finding = PcbBusRoutingConstraintError | PcbBusRoutingConstraintWarning
/** Explicit constraints only. Board-world XY mm, +X right/+Y up.
 * Measures complete planar routes, never cached lengths or guessed via depths.
 * Missing physical inputs yield warnings rather than an electrical pass. */
export function checkPcbRoutingConstraints(
  circuit: AnyCircuitElement[],
): Finding[] {
  const findings: Finding[] = []
  const buses = circuit.filter((e): e is SourceBus => e.type === "source_bus")
  const sources = new Map(
    circuit
      .filter((e): e is SourceTrace => e.type === "source_trace")
      .map((e) => [e.source_trace_id, e]),
  )
  const traces = circuit.filter((e): e is PcbTrace => e.type === "pcb_trace")
  const tracesBySource = new Map<string, PcbTrace[]>()
  for (const trace of traces) {
    if (!trace.source_trace_id) continue
    const list = tracesBySource.get(trace.source_trace_id) ?? []
    list.push(trace)
    tracesBySource.set(trace.source_trace_id, list)
  }
  const measures = new Map<string, RouteMeasurement | undefined>()
  const measure = (id: string) => {
    if (!measures.has(id)) {
      const source = sources.get(id)
      measures.set(
        id,
        source && measureRoute(source, tracesBySource.get(id) ?? [], circuit),
      )
    }
    return measures.get(id)
  }
  // Include partial and unrelated copper as spacing obstacles. It need not have
  // a complete pad-to-pad route, or belong to another declared bus.
  const copper: Array<{ trace: PcbTrace; segment: RouteSegment }> = []
  for (const trace of traces) {
    for (let i = 0; i < trace.route.length - 1; i++) {
      const p = trace.route[i]!,
        q = trace.route[i + 1]!
      if (p.route_type === "through_pad" || q.route_type === "through_pad")
        continue
      const pl = p.route_type === "wire" ? p.layer : p.to_layer
      const ql = q.route_type === "wire" ? q.layer : q.from_layer
      const width = Math.max(
        p.route_type === "wire" ? Math.max(p.width, p.end_width ?? p.width) : 0,
        q.route_type === "wire" ? Math.max(q.width, q.end_width ?? q.width) : 0,
      )
      if (
        pl !== ql ||
        width <= 0 ||
        ![p.x, p.y, q.x, q.y, width].every(Number.isFinite)
      )
        continue
      copper.push({ trace, segment: { a: p, b: q, layer: pl, width } })
    }
  }
  const index = copper.length ? new Flatbush(copper.length) : undefined
  let maxWidth = 0
  for (const { segment: s } of copper) {
    maxWidth = Math.max(maxWidth, s.width)
    index!.add(
      Math.min(s.a.x, s.b.x),
      Math.min(s.a.y, s.b.y),
      Math.max(s.a.x, s.b.x),
      Math.max(s.a.y, s.b.y),
    )
  }
  index?.finish()
  const separation = (spacing: SourceBusTraceSpacing, width: number) =>
    typeof spacing === "number" ? spacing : spacing.width_multiplier * width
  const pairPartners = new Set(
    buses
      .filter((b) => b.differential_pair)
      .map((b) =>
        [
          b.differential_pair!.positive_source_trace_id,
          b.differential_pair!.negative_source_trace_id,
        ]
          .sort()
          .join("|"),
      ),
  )

  for (const bus of buses) {
    if (!hasSourceBusRoutingConstraints(bus)) continue
    const members = [...new Set(bus.source_trace_ids)]
    const matchMembers = [
      ...new Set([...members, ...(bus.length_match_source_trace_ids ?? [])]),
    ]
    const context = (ids: string[], warning: boolean, message: string) => ({
      message: `${warning ? "Unverified " : ""}bus ${getReadableNameForElementId(circuit, bus.source_bus_id)}: ${message}`,
      source_bus_id: bus.source_bus_id,
      source_trace_ids: ids,
      pcb_trace_ids: ids.flatMap((id) =>
        (tracesBySource.get(id) ?? []).map((trace) => trace.pcb_trace_id),
      ),
      subcircuit_id: bus.subcircuit_id,
    })
    const reportWarning = (
      rule: PcbBusRoutingConstraintWarning["routing_rule"],
      message: string,
      id = members[0]!,
    ) => {
      findings.push(
        pcb_bus_routing_constraint_warning.parse({
          type: "pcb_bus_routing_constraint_warning",
          pcb_bus_routing_constraint_warning_id: `pcb_bus_routing_constraint_warning_${bus.source_bus_id}_${findings.length}`,
          ...context([id], true, message),
          routing_rule: rule,
        }),
      )
    }
    const reportError = (
      violation: PcbBusRoutingConstraintViolation,
      message: string,
      id = members[0]!,
    ) => {
      const ids = violation.routing_rule === "length_skew" ? matchMembers : [id]
      findings.push(
        pcb_bus_routing_constraint_error.parse({
          type: "pcb_bus_routing_constraint_error",
          pcb_bus_routing_constraint_error_id: `pcb_bus_routing_constraint_error_${bus.source_bus_id}_${findings.length}`,
          ...context(ids, false, message),
          ...violation,
        }),
      )
    }
    const complete = (
      ids: string[],
      rule: PcbBusRoutingConstraintWarning["routing_rule"],
    ) => {
      const missing = ids.find((id) => !measure(id))
      if (missing)
        reportWarning(
          rule,
          "a signal lacks complete, unbranched pad-to-pad geometry",
          missing,
        )
      return !missing
    }
    if (
      bus.max_length_skew !== undefined &&
      complete(matchMembers, "route_geometry")
    ) {
      const lengths = matchMembers.map((id) => measure(id)!.length)
      const skew = Math.max(...lengths) - Math.min(...lengths)
      if (skew > bus.max_length_skew + EPS)
        reportError(
          {
            routing_rule: "length_skew",
            actual_length_skew: skew,
            maximum_length_skew: bus.max_length_skew,
          },
          `planar length skew is ${skew.toFixed(3)} mm`,
          matchMembers[lengths.indexOf(Math.max(...lengths))]!,
        )
    }

    const resolveLength = (length: SourceBusRouteLength | undefined) => {
      if (length === undefined || typeof length === "number") return length
      const ids = length.source_trace_ids ?? matchMembers
      if (!ids.length || !complete(ids, "reference_geometry")) return
      return (
        Math.max(...ids.map((id) => measure(id)!.manhattan)) +
        (length.offset ?? 0)
      )
    }
    const min = resolveLength(bus.min_length),
      max = resolveLength(bus.max_length),
      target = resolveLength(bus.target_length)
    if (bus.target_length !== undefined && bus.length_tolerance === undefined)
      reportWarning(
        "target_length",
        "a target length requires an explicit length tolerance",
      )
    else if (
      bus.length_tolerance !== undefined &&
      bus.target_length === undefined
    )
      reportWarning(
        "target_length",
        "a length tolerance requires an explicit target length",
      )
    if (
      [bus.min_length, bus.max_length, bus.target_length].some(
        (v) => v !== undefined,
      ) &&
      complete(members, "route_geometry")
    ) {
      for (const id of members) {
        const length = measure(id)!.length
        if (min !== undefined && length < min - EPS)
          reportError(
            {
              routing_rule: "min_length",
              actual_trace_length: length,
              minimum_trace_length: min,
            },
            "planar length is below the declared minimum",
            id,
          )
        if (max !== undefined && length > max + EPS)
          reportError(
            {
              routing_rule: "max_length",
              actual_trace_length: length,
              maximum_trace_length: max,
            },
            "planar length exceeds the declared maximum",
            id,
          )
        if (
          target !== undefined &&
          bus.length_tolerance !== undefined &&
          Math.abs(length - target) > bus.length_tolerance + EPS
        )
          reportError(
            {
              routing_rule: "target_length",
              actual_trace_length: length,
              target_trace_length: target,
              length_tolerance: bus.length_tolerance,
            },
            "planar length is outside the target tolerance",
            id,
          )
      }
    }

    for (const id of members) {
      if (
        bus.pcb_trace_spacing === undefined &&
        bus.pcb_spacing_to_other_signals === undefined
      )
        break
      const measured = measure(id)
      if (!measured) {
        reportWarning(
          "spacing_geometry",
          "spacing requires supported route geometry",
          id,
        )
        continue
      }
      const failed = new Set<string>()
      for (const a of measured.segments) {
        const margin = Math.max(
          ...[bus.pcb_trace_spacing, bus.pcb_spacing_to_other_signals]
            .filter((v) => v !== undefined)
            .map((v) => separation(v!, Math.max(a.width, maxWidth))),
        )
        for (const k of index?.search(
          Math.min(a.a.x, a.b.x) - margin,
          Math.min(a.a.y, a.b.y) - margin,
          Math.max(a.a.x, a.b.x) + margin,
          Math.max(a.a.y, a.b.y) + margin,
        ) ?? []) {
          const { trace, segment: b } = copper[k]!,
            otherId = trace.source_trace_id
          if (
            id === otherId ||
            a.layer !== b.layer ||
            (otherId && pairPartners.has([id, otherId].sort().join("|")))
          )
            continue
          // Different source traces on the same net are the same electrical signal.
          if (
            otherId &&
            sources
              .get(id)
              ?.connected_source_net_ids.some((net) =>
                sources.get(otherId)?.connected_source_net_ids.includes(net),
              )
          )
            continue
          const internal = otherId !== undefined && members.includes(otherId)
          const spacing = internal
            ? bus.pcb_trace_spacing
            : bus.pcb_spacing_to_other_signals
          if (spacing === undefined) continue
          const required = separation(spacing, Math.max(a.width, b.width))
          if (capsuleIntervals(a, b, required - EPS).length) {
            const rule = internal
              ? "pcb_trace_spacing"
              : "pcb_spacing_to_other_signals"
            if (!failed.has(rule))
              reportError(
                {
                  routing_rule: rule,
                  other_pcb_trace_id: trace.pcb_trace_id,
                  other_source_trace_id: otherId,
                  actual_centerline_spacing: segmentSeparation(a, b),
                  minimum_centerline_spacing: required,
                },
                `${getReadableNameForElementId(circuit, id)} falls below declared centreline spacing`,
                id,
              )
            failed.add(rule)
          }
        }
      }
    }
    for (const [target, min, max] of [
      [
        bus.target_impedance,
        bus.target_impedance_min,
        bus.target_impedance_max,
      ],
      [
        bus.target_differential_impedance,
        bus.target_differential_impedance_min,
        bus.target_differential_impedance_max,
      ],
    ]) {
      if ([target, min, max].every((v) => v === undefined)) continue
      if (
        target !== undefined &&
        ((min !== undefined && target < min - EPS) ||
          (max !== undefined && target > max + EPS))
      )
        reportError(
          {
            routing_rule: "impedance_target",
            target_impedance: target,
            minimum_impedance: min,
            maximum_impedance: max,
          },
          "declared impedance target is outside its bounds",
        )
      reportWarning(
        "physical_impedance",
        "actual impedance requires physical stackup analysis; declared targets are not measured impedance",
      )
    }
  }
  return findings
}
