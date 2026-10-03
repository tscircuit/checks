import { checkDdrSpacing } from "./util/check-ddr-spacing"
import type {
  AnyCircuitElement,
  PcbDdrRoutingError,
  SourceBus,
  SourceTrace,
} from "circuit-json"
import { getReadableNameForElementId } from "./util/get-readable-names"
import {
  measureDdrRoute,
  type DdrRouteMeasurement,
} from "./util/measure-ddr-route"

const MIL = 0.0254
const EPS = 1e-8
/** TI AM335x SPRS717L, one-x16 DDR3 topology. Opt-in semantic groups,
 * scoped to a subcircuit. This is a geometric audit, not SI sign-off: missing
 * physical inputs remain findings even when all measurable rules pass. */
export function checkPcbDdrRouting(
  circuit: AnyCircuitElement[],
): PcbDdrRoutingError[] {
  const errors: PcbDdrRoutingError[] = []
  const groups = new Map<string, SourceBus[]>()
  for (const bus of circuit.filter(
    (e): e is SourceBus => e.type === "source_bus",
  )) {
    if (!bus.ddr_routing) continue
    const key = JSON.stringify([
      bus.subcircuit_id,
      bus.ddr_routing.interface_name,
    ])
    groups.set(key, [...(groups.get(key) ?? []), bus])
  }
  const sources = new Map(
    circuit
      .filter((e): e is SourceTrace => e.type === "source_trace")
      .map((e) => [e.source_trace_id, e]),
  )
  for (const originalBuses of groups.values()) {
    // A routing byte bus may include its associated strobe pair. Resolve the
    // semantic data/mask class using explicit pair metadata, never net names.
    const buses = originalBuses.map((bus) => {
      if (bus.ddr_routing!.signal_class !== "dq") return bus
      const strobeIds = new Set(
        originalBuses
          .filter(
            (other) =>
              other.ddr_routing!.signal_class === "dqs" &&
              other.ddr_routing!.byte_index === bus.ddr_routing!.byte_index,
          )
          .flatMap((other) => other.source_trace_ids),
      )
      return {
        ...bus,
        source_trace_ids: bus.source_trace_ids.filter(
          (id) => !strobeIds.has(id),
        ),
      }
    })
    const report = (
      status: PcbDdrRoutingError["status"],
      rule: string,
      section: string,
      message: string,
      selected: SourceBus[] = buses,
      values: Partial<
        Pick<
          PcbDdrRoutingError,
          "actual_value" | "expected_min" | "expected_max" | "units"
        >
      > = {},
    ) => {
      const ids = [...new Set(selected.flatMap((b) => b.source_trace_ids))]
      errors.push({
        type: "pcb_ddr_routing_error",
        error_type: "pcb_ddr_routing_error",
        pcb_ddr_routing_error_id: `pcb_ddr_routing_error_${selected[0]!.source_bus_id}_${rule}_${errors.length}`,
        status,
        rule,
        specification: "SPRS717L",
        specification_section: section,
        message: `DDR ${getReadableNameForElementId(circuit, selected[0]!.source_bus_id)}: ${message}`,
        source_bus_ids: selected.map((b) => b.source_bus_id),
        source_trace_ids: ids,
        pcb_trace_ids: circuit
          .filter(
            (e) =>
              e.type === "pcb_trace" &&
              e.source_trace_id &&
              ids.includes(e.source_trace_id),
          )
          .map((e) => (e.type === "pcb_trace" ? e.pcb_trace_id : "")),
        subcircuit_id: buses[0]!.subcircuit_id,
        ...values,
      })
    }
    const roles = new Map<string, SourceBus[]>()
    const measures = new Map<
      SourceTrace["source_trace_id"],
      DdrRouteMeasurement
    >()
    const owners = new Map<SourceTrace["source_trace_id"], SourceBus>()
    for (const bus of buses) {
      const intent = bus.ddr_routing!
      const byteClass =
        intent.signal_class === "dq" || intent.signal_class === "dqs"
      if (
        intent.profile !== "ti_am335x_ddr3" ||
        intent.topology !== "one_x16" ||
        byteClass !== (intent.byte_index !== undefined)
      ) {
        report(
          "unverified",
          "group_definition",
          "Tables 7-66 and 7-67",
          "unsupported or incomplete DDR group declaration",
          [bus],
        )
        continue
      }
      const role = `${intent.signal_class}${byteClass ? intent.byte_index : ""}`
      roles.set(role, [...(roles.get(role) ?? []), bus])
      const members = [...new Set(bus.source_trace_ids)]
      const expected =
        intent.signal_class === "dq"
          ? 9
          : intent.signal_class === "addr_ctrl"
            ? undefined
            : 2
      if (
        members.length !== bus.source_trace_ids.length ||
        (expected !== undefined && members.length !== expected) ||
        !members.length
      )
        report(
          "unverified",
          "group_membership",
          "Tables 7-66 and 7-67",
          "group must contain distinct members: nine data/mask signals per byte, or two signals per differential pair",
          [bus],
        )
      if (intent.signal_class === "dqs" || intent.signal_class === "ck") {
        const pair = bus.differential_pair
        if (
          !pair ||
          pair.positive_source_trace_id === pair.negative_source_trace_id ||
          !members.includes(pair.positive_source_trace_id) ||
          !members.includes(pair.negative_source_trace_id)
        )
          report(
            "unverified",
            "pair_polarity",
            "Table 7-67",
            "resolved positive and negative pair members are required",
            [bus],
          )
      }
      for (const id of members) {
        if (owners.has(id))
          report(
            "unverified",
            "ambiguous_membership",
            "Tables 7-66 and 7-67",
            "a signal belongs to multiple DDR classes",
            [owners.get(id)!, bus],
          )
        owners.set(id, bus)
        const source = sources.get(id)
        const traces = circuit.filter(
          (e) => e.type === "pcb_trace" && e.source_trace_id === id,
        )
        const measured = source
          ? measureDdrRoute(
              source,
              traces.filter((e) => e.type === "pcb_trace"),
              circuit,
            )
          : undefined
        if (measured) measures.set(id, measured)
        else
          report(
            "unverified",
            "route_geometry",
            "Tables 7-68 and 7-69",
            "a member lacks a complete, unbranched pad-to-pad route with supported geometry",
            [bus],
          )
      }
      const target =
        bus.target_impedance ??
        (bus.target_differential_impedance !== undefined
          ? bus.target_differential_impedance / 2
          : undefined)
      if (target !== undefined && (target < 50 || target > 75))
        report(
          "violation",
          "impedance_target",
          "Table 7-62",
          "declared single-ended impedance must be between 50 and 75 ohms",
          [bus],
          {
            actual_value: target,
            expected_min: 50,
            expected_max: 75,
            units: "ohm",
          },
        )
    }
    for (const role of ["dq0", "dq1", "dqs0", "dqs1", "ck", "addr_ctrl"]) {
      if (roles.get(role)?.length !== 1)
        report(
          "unverified",
          "interface_completeness",
          "Tables 7-66 and 7-67",
          `exactly one ${role} group is required per interface`,
        )
    }
    const members = (role: string) =>
      (roles.get(role) ?? []).flatMap((b) => b.source_trace_ids)
    const complete = (ids: string[]) =>
      ids.length > 0 && ids.every((id) => measures.has(id))
    const lengths = (ids: string[]) => ids.map((id) => measures.get(id)!.length)
    const skew = (role: string, max: number, section: string) => {
      const ids = members(role)
      if (!complete(ids)) return
      const value = Math.max(...lengths(ids)) - Math.min(...lengths(ids))
      if (value > max + EPS)
        report(
          "violation",
          `${role}_skew`,
          section,
          `planar length skew is ${value.toFixed(3)} mm; maximum is ${max.toFixed(3)} mm`,
          roles.get(role)!,
          { actual_value: value, expected_max: max, units: "mm" },
        )
    }
    skew("ck", 5 * MIL, "Table 7-68")
    for (const byte of [0, 1]) {
      skew(`dq${byte}`, 25 * MIL, "Table 7-69")
      skew(`dqs${byte}`, 5 * MIL, "Table 7-69")
      const dq = members(`dq${byte}`),
        dqs = members(`dqs${byte}`),
        ids = [...dq, ...dqs]
      if (!complete(ids)) continue
      const groups = [
        ...(roles.get(`dq${byte}`) ?? []),
        ...(roles.get(`dqs${byte}`) ?? []),
      ]
      const delta = Math.max(
        ...dq.flatMap((d) =>
          dqs.map((s) =>
            Math.abs(measures.get(d)!.length - measures.get(s)!.length),
          ),
        ),
      )
      if (delta > 25 * MIL + EPS)
        report(
          "violation",
          "data_to_strobe_skew",
          "Table 7-69",
          `data-to-associated-strobe skew is ${delta.toFixed(3)} mm`,
          groups,
          { actual_value: delta, expected_max: 25 * MIL, units: "mm" },
        )
      // DQLMn is the longest Manhattan data/strobe endpoint distance. The
      // 25-mil skew allowance is NOT added to the nominal maximum length.
      const limit = Math.max(...ids.map((id) => measures.get(id)!.manhattan))
      const maximum = Math.max(...lengths(dq))
      if (maximum > limit + EPS)
        report(
          "violation",
          "data_nominal_length",
          "Table 7-69",
          `longest data route is ${maximum.toFixed(3)} mm; byte Manhattan limit is ${limit.toFixed(3)} mm`,
          groups,
          { actual_value: maximum, expected_max: limit, units: "mm" },
        )
    }
    const command = [...members("addr_ctrl"), ...members("ck")]
    if (complete(command)) {
      const nominal =
        Math.max(...command.map((id) => measures.get(id)!.manhattan)) +
        300 * MIL
      for (const id of command) {
        const length = measures.get(id)!.length
        if (
          length < nominal - 50 * MIL - EPS ||
          length > nominal + 50 * MIL + EPS
        )
          report(
            "violation",
            "command_clock_nominal_length",
            "Table 7-68",
            `address/command or clock route is ${length.toFixed(3)} mm, outside the common nominal length window`,
            [owners.get(id)!],
            {
              actual_value: length,
              expected_min: nominal - 50 * MIL,
              expected_max: nominal + 50 * MIL,
              units: "mm",
            },
          )
      }
    }
    for (const finding of checkDdrSpacing(measures, owners)) {
      const owner = owners.get(finding.sourceTraceId)!
      if (finding.belowMinimum)
        report(
          "violation",
          "minimum_ddr_spacing",
          "Tables 7-68 and 7-69",
          "DDR centreline separation falls below one trace width",
          [owner],
        )
      if (finding.reducedLength > 1250 * MIL + EPS)
        report(
          "violation",
          "reduced_ddr_spacing_length",
          "Tables 7-68 and 7-69",
          `reduced DDR centreline spacing extends for ${finding.reducedLength.toFixed(3)} mm; maximum is 31.750 mm`,
          [owner],
          {
            actual_value: finding.reducedLength,
            expected_max: 1250 * MIL,
            units: "mm",
          },
        )
    }
    const board = circuit.find(
      (e) =>
        e.type === "pcb_board" &&
        (!buses[0]!.subcircuit_id ||
          e.subcircuit_id === buses[0]!.subcircuit_id),
    )
    if (board?.type === "pcb_board" && board.num_layers < 4)
      report(
        "violation",
        "minimum_layer_count",
        "Table 7-62",
        "DDR3 requires at least four PCB layers",
        buses,
        { actual_value: board.num_layers, expected_min: 4, units: "count" },
      )
    else if (!board)
      report(
        "unverified",
        "minimum_layer_count",
        "Table 7-62",
        "board layer count is missing",
      )
    // Deliberately fail closed for requirements not established by route XY.
    for (const [rule, section, message] of [
      [
        "impedance",
        "Table 7-62",
        "actual segment impedance and pair impedance require a physical stackup and impedance analysis; target values alone do not prove compliance",
      ],
      [
        "reference_planes",
        "Tables 7-62 and 7-63",
        "continuous adjacent ground/power reference planes, plane cuts, and reference changes have not been verified",
      ],
      [
        "placement",
        "Table 7-63",
        "DDR placement distances require the processor DDR-edge coordinate frame",
      ],
      [
        "non_ddr_keepout",
        "Table 7-63",
        "DDR-region spacing to unrelated copper and ground isolation from unrelated signal layers have not been verified",
      ],
      [
        "command_topology_segments",
        "Table 7-68",
        "address/clock segment limits, branch/stub skew and termination topology have not been verified",
      ],
      [
        "power_and_termination",
        "Tables 7-64, 7-65, 7-68 and 7-69",
        "decoupling placement/capacitance, allowed termination and programmed DDR ODT have not been verified",
      ],
      [
        "flight_time",
        "Tables 7-68 and 7-69",
        "planar lengths exclude via barrel depth and do not establish electrical delay or signal integrity",
      ],
    ])
      report("unverified", rule!, section!, message!)
  }
  return errors
}
