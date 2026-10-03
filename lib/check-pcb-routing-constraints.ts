import Flatbush from "flatbush"
import type {
  AnyCircuitElement,
  PcbRoutingConstraintError,
  SourceBus,
  SourceTrace,
  PcbTrace,
} from "circuit-json"
import { getReadableNameForElementId } from "./util/get-readable-names"
import { measureRoute, type RouteMeasurement } from "./util/measure-route"
import { capsuleIntervals, unionLength } from "./util/check-route-spacing"

const EPS = 1e-8
/** Checks only explicitly declared constraints, scoped to each subcircuit.
 * Route lengths and pad endpoints use board-world XY (+X right, +Y up), mm.
 * Via barrel depth and electrical delay are not inferred from planar geometry. */
export function checkPcbRoutingConstraints(
  circuit: AnyCircuitElement[],
): PcbRoutingConstraintError[] {
  const errors: PcbRoutingConstraintError[] = []
  const buses = circuit.filter((e): e is SourceBus => e.type === "source_bus")
  const sources = new Map(
    circuit
      .filter((e): e is SourceTrace => e.type === "source_trace")
      .map((e) => [e.source_trace_id, e]),
  )
  const measures = new Map<
    SourceTrace["source_trace_id"],
    RouteMeasurement | undefined
  >()
  const measure = (bus: SourceBus) => {
    for (const id of bus.source_trace_ids) {
      if (measures.has(id)) continue
      const source = sources.get(id)
      measures.set(
        id,
        source &&
          measureRoute(
            source,
            circuit.filter(
              (e): e is PcbTrace =>
                e.type === "pcb_trace" && e.source_trace_id === id,
            ),
            circuit,
          ),
      )
    }
    return bus.source_trace_ids.every((id) => measures.get(id) !== undefined)
  }
  for (const bus of buses) {
    const constraints = bus.routing_constraints
    if (!constraints) continue
    const report = (
      status: PcbRoutingConstraintError["status"],
      rule: string,
      message: string,
      values: Partial<
        Pick<
          PcbRoutingConstraintError,
          "actual_value" | "expected_min" | "expected_max" | "units"
        >
      > = {},
      related: SourceBus[] = [bus],
    ) => {
      const ids = [...new Set(related.flatMap((b) => b.source_trace_ids))]
      errors.push({
        type: "pcb_routing_constraint_error",
        error_type: "pcb_routing_constraint_error",
        pcb_routing_constraint_error_id: `pcb_routing_constraint_error_${bus.source_bus_id}_${errors.length}`,
        status,
        rule,
        message: `Bus ${getReadableNameForElementId(circuit, bus.source_bus_id)}: ${message}`,
        source_bus_ids: related.map((b) => b.source_bus_id),
        source_trace_ids: ids,
        pcb_trace_ids: circuit
          .filter(
            (e) =>
              e.type === "pcb_trace" &&
              e.source_trace_id &&
              ids.includes(e.source_trace_id),
          )
          .map((e) => (e.type === "pcb_trace" ? e.pcb_trace_id : "")),
        subcircuit_id: bus.subcircuit_id,
        ...values,
      })
    }
    const resolveBus = (name: string) => {
      const matches = buses.filter(
        (other) =>
          other.name === name && other.subcircuit_id === bus.subcircuit_id,
      )
      if (matches.length !== 1) {
        report(
          "unverified",
          "bus_reference",
          `requires one bus named ${name} in the same subcircuit`,
        )
        return
      }
      return matches[0]!
    }
    const uniqueMembers = new Set(bus.source_trace_ids)
    if (
      uniqueMembers.size !== bus.source_trace_ids.length ||
      (constraints?.expected_trace_count !== undefined &&
        uniqueMembers.size !== constraints.expected_trace_count)
    )
      report(
        "violation",
        "member_count",
        "distinct member count does not match the declared constraint",
        {
          actual_value: uniqueMembers.size,
          expected_min: constraints?.expected_trace_count,
          expected_max: constraints?.expected_trace_count,
          units: "count",
        },
      )
    const needsRoute =
      bus.max_length_skew !== undefined ||
      constraints?.length_bounds ||
      constraints?.spacing
    if (needsRoute && !measure(bus)) {
      report(
        "unverified",
        "route_geometry",
        "a member lacks a complete, unbranched pad-to-pad route with supported geometry",
      )
      continue
    }
    if (bus.max_length_skew !== undefined) {
      const lengths = bus.source_trace_ids.map((id) => measures.get(id)!.length)
      const skew = Math.max(...lengths) - Math.min(...lengths)
      if (skew > bus.max_length_skew + EPS)
        report(
          "violation",
          "length_skew",
          `planar length skew is ${skew.toFixed(3)} mm`,
          {
            actual_value: skew,
            expected_max: bus.max_length_skew,
            units: "mm",
          },
        )
    }
    const checkLengthBounds = () => {
      const bounds = constraints?.length_bounds
      if (bounds) {
        let reference = 0
        let referenceBus: SourceBus | undefined
        if (bounds.reference_bus) {
          referenceBus = resolveBus(bounds.reference_bus)
          if (!referenceBus) return
          if (!measure(referenceBus)) {
            report(
              "unverified",
              "reference_geometry",
              "length reference lacks complete pad-to-pad geometry",
              {},
              [bus, referenceBus],
            )
            return
          }
          reference = Math.max(
            ...referenceBus.source_trace_ids.map(
              (id) => measures.get(id)!.manhattan,
            ),
          )
        }
        const min =
          bounds.min === undefined ? undefined : reference + bounds.min
        const max =
          bounds.max === undefined ? undefined : reference + bounds.max
        for (const id of bus.source_trace_ids) {
          const length = measures.get(id)!.length
          if (
            (min !== undefined && length < min - EPS) ||
            (max !== undefined && length > max + EPS)
          )
            report(
              "violation",
              "length_bounds",
              `${getReadableNameForElementId(circuit, id)} planar length is ${length.toFixed(3)} mm, outside declared bounds`,
              {
                actual_value: length,
                expected_min: min,
                expected_max: max,
                units: "mm",
              },
              referenceBus && referenceBus !== bus
                ? [bus, referenceBus]
                : [bus],
            )
        }
      }
    }
    checkLengthBounds()
    const spacingRules = (constraints?.spacing ?? []).flatMap((rule) => {
      const otherBus = resolveBus(rule.other_bus)
      if (!otherBus) return []
      if (!measure(otherBus)) {
        report(
          "unverified",
          "spacing_geometry",
          "spacing comparison lacks complete route geometry",
          {},
          [bus, otherBus],
        )
        return []
      }
      const segments = otherBus.source_trace_ids.flatMap((id) =>
        measures.get(id)!.segments.map((segment) => ({ id, segment })),
      )
      const index = new Flatbush(segments.length)
      let maxWidth = 0
      for (const { segment } of segments) {
        maxWidth = Math.max(maxWidth, segment.width)
        index.add(
          Math.min(segment.a.x, segment.b.x),
          Math.min(segment.a.y, segment.b.y),
          Math.max(segment.a.x, segment.b.x),
          Math.max(segment.a.y, segment.b.y),
        )
      }
      index.finish()
      return [{ rule, otherBus, segments, index, maxWidth }]
    })
    // Pair-internal spacing is independent of bus-to-bus separation.
    const pairs = buses
      .filter(
        (b) => b.subcircuit_id === bus.subcircuit_id && b.differential_pair,
      )
      .map((b) => b.differential_pair!)
    if (spacingRules.length)
      for (const id of bus.source_trace_ids) {
        let reducedLength = 0
        let belowMinimum = false
        for (const a of measures.get(id)!.segments) {
          const intervals: [number, number][] = []
          for (const { rule, segments, index, maxWidth } of spacingRules) {
            const margin =
              rule.centerline_width_multiplier * Math.max(a.width, maxWidth)
            const candidates = index.search(
              Math.min(a.a.x, a.b.x) - margin,
              Math.min(a.a.y, a.b.y) - margin,
              Math.max(a.a.x, a.b.x) + margin,
              Math.max(a.a.y, a.b.y) + margin,
            )
            for (const k of candidates) {
              const { id: otherId, segment: b } = segments[k]!
              if (
                id === otherId ||
                a.layer !== b.layer ||
                pairs.some(
                  (p) =>
                    (p.positive_source_trace_id === id &&
                      p.negative_source_trace_id === otherId) ||
                    (p.negative_source_trace_id === id &&
                      p.positive_source_trace_id === otherId),
                )
              )
                continue
              const width = Math.max(a.width, b.width)
              const normal = capsuleIntervals(
                a,
                b,
                rule.centerline_width_multiplier * width - EPS,
              )
              if (rule.reduced_centerline_width_multiplier !== undefined)
                intervals.push(...normal)
              belowMinimum ||=
                capsuleIntervals(
                  a,
                  b,
                  (rule.reduced_centerline_width_multiplier ??
                    rule.centerline_width_multiplier) *
                    width -
                    EPS,
                ).length > 0
            }
          }
          // Union across all neighbours AND rules, not a separate budget per bus.
          reducedLength +=
            unionLength(intervals) * Math.hypot(a.b.x - a.a.x, a.b.y - a.a.y)
        }
        const related = [
          ...new Set([bus, ...spacingRules.map((r) => r.otherBus)]),
        ]
        if (belowMinimum)
          report(
            "violation",
            "minimum_spacing",
            `${getReadableNameForElementId(circuit, id)} falls below declared centreline spacing`,
            {},
            related,
          )
        if (
          constraints!.max_reduced_spacing_length !== undefined &&
          reducedLength > constraints!.max_reduced_spacing_length + EPS
        )
          report(
            "violation",
            "reduced_spacing_length",
            `${getReadableNameForElementId(circuit, id)} has ${reducedLength.toFixed(3)} mm of reduced spacing`,
            {
              actual_value: reducedLength,
              expected_max: constraints!.max_reduced_spacing_length,
              units: "mm",
            },
            related,
          )
      }
    const impedance = constraints?.impedance_bounds
    if (impedance) {
      const target = bus.differential_pair
        ? bus.target_differential_impedance
        : bus.target_impedance
      if (target === undefined)
        report(
          "unverified",
          "impedance_target",
          "no impedance target is declared",
        )
      else if (
        (impedance.min !== undefined && target < impedance.min - EPS) ||
        (impedance.max !== undefined && target > impedance.max + EPS)
      )
        report(
          "violation",
          "impedance_target",
          "declared impedance target is outside its bounds",
          {
            actual_value: target,
            expected_min: impedance.min,
            expected_max: impedance.max,
            units: "ohm",
          },
        )
      report(
        "unverified",
        "physical_impedance",
        "actual impedance requires physical stackup analysis; this check evaluates declared targets only",
      )
    }
  }
  return errors
}
