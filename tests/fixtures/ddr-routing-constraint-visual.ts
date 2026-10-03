import type {
  AnyCircuitElement,
  LayerRef,
  PcbTrace,
  SourceBus,
  SourceTrace,
} from "circuit-json"
import { checkPcbRoutingConstraints } from "../../lib/check-pcb-routing-constraints"
import { measureRoute } from "../../lib/util/measure-route"

// Deterministic routed byte-lane coupon: BGA escapes, two vias per signal,
// 45-degree approaches and smooth length-tuning lobes on inner1. Geometry is
// authored here rather than rerunning an autorouter in every checks test.
// Every displayed copper segment comes from the circuit passed to the check.
export function ddrByteLane() {
  const circuit: AnyCircuitElement[] = []
  const traces: PcbTrace[] = []
  const names = [
    ...Array.from({ length: 8 }, (_, i) => `DQ${i}`),
    "DQS+",
    "DQS-",
  ]
  names.forEach((name, i) => {
    const y = i < 8 ? 3.5 - i : -5 - (i - 8) * 0.22
    const source = `signal_${i}`
    circuit.push({
      type: "source_trace",
      source_trace_id: source,
      name,
      connected_source_port_ids: [`${source}_tx`, `${source}_rx`],
      connected_source_net_ids: [],
    })
    for (const [end, x] of [
      ["tx", -12],
      ["rx", 12],
    ] as const) {
      circuit.push({
        type: "pcb_port",
        pcb_port_id: `${source}_${end}_pcb`,
        source_port_id: `${source}_${end}`,
        x,
        y: y + 0.4,
        layers: ["top"],
      })
    }
    const wire = (x: number, y: number, layer: LayerRef = "inner1") => ({
      route_type: "wire" as const,
      x,
      y,
      layer,
      width: 0.1,
    })
    const via = (
      x: number,
      y: number,
      from_layer: LayerRef,
      to_layer: LayerRef,
    ) => ({ route_type: "via" as const, x, y, from_layer, to_layer })
    const route: PcbTrace["route"] = [
      wire(-12, y + 0.4, "top"),
      wire(-11.6, y, "top"),
      via(-11.6, y, "top", "inner1"),
      wire(-11.6, y),
      wire(-10, y),
      wire(-9.5, y + 0.5),
      wire(-7, y + 0.5),
    ]
    // sin² lobes have a horizontal tangent at both joins. Each baseline route
    // has the same tuning length, including the translated strobe partners.
    for (let lobe = 0; lobe < 4; lobe++) {
      for (let step = 1; step <= 24; step++) {
        const t = step / 24
        route.push(
          wire(
            -7 + lobe * 2 + t * 2,
            y + 0.5 + 0.25 * Math.sin(Math.PI * t) ** 2,
          ),
        )
      }
    }
    route.push(
      wire(9.5, y + 0.5),
      wire(10, y),
      wire(11.6, y),
      via(11.6, y, "inner1", "top"),
      wire(11.6, y, "top"),
      wire(12, y + 0.4, "top"),
    )
    const trace: PcbTrace = {
      type: "pcb_trace",
      pcb_trace_id: `copper_${i}`,
      source_trace_id: source,
      route,
    }
    traces.push(trace)
    circuit.push(trace)
  })
  const bus: SourceBus = {
    type: "source_bus",
    source_bus_id: "byte0",
    name: "DDR BYTE0",
    source_trace_ids: traces.slice(0, 8).map((t) => t.source_trace_id!),
    length_match_source_trace_ids: traces
      .slice(8)
      .map((t) => t.source_trace_id!),
    max_length_skew: 0.635,
    pcb_trace_spacing: 0.3,
    pcb_spacing_to_other_signals: 0.4,
  }
  circuit.push(bus, {
    type: "source_bus",
    source_bus_id: "strobe",
    name: "DQS",
    source_trace_ids: traces.slice(8).map((t) => t.source_trace_id!),
    differential_pair: {
      positive_source_trace_id: traces[8]!.source_trace_id!,
      negative_source_trace_id: traces[9]!.source_trace_id!,
      trace_gap: 0.12,
    },
  })
  return { circuit, traces, bus }
}

export type VisualRule =
  | "length_skew"
  | "min_length"
  | "max_length"
  | "target_length"
  | "pcb_trace_spacing"
  | "pcb_spacing_to_other_signals"
export function ddrScenario(rule: VisualRule) {
  const control = ddrByteLane()
  const changed = ddrByteLane()
  if (rule === "min_length")
    control.bus.min_length = changed.bus.min_length = 24.9
  if (rule === "max_length")
    control.bus.max_length = changed.bus.max_length = 26
  if (rule === "target_length") {
    control.bus.target_length = changed.bus.target_length = 25.05
    control.bus.length_tolerance = changed.bus.length_tolerance = 0.25
  }
  if (
    rule === "min_length" ||
    rule === "max_length" ||
    rule === "target_length"
  )
    control.bus.max_length_skew = changed.bus.max_length_skew = undefined
  const bad = changed.traces[0]!
  if (rule === "min_length") {
    for (const point of bad.route)
      if (point.route_type === "wire" && point.x >= -7 && point.x <= 1)
        point.y = 4
  } else if (
    rule === "length_skew" ||
    rule === "max_length" ||
    rule === "target_length"
  ) {
    // Increase one smooth lobe's amplitude, preserving all endpoints/layers.
    for (const point of bad.route)
      if (point.route_type === "wire" && point.x > -7 && point.x < -5) {
        point.y += 1.5 * Math.sin((Math.PI * (point.x + 7)) / 2) ** 2
      }
  } else {
    const neighbor = changed.traces[1]!
    // A smooth misplaced tuning bulge approaches DQ0 at x=4. Centerline
    // distance is 0.2mm, still leaving 0.1mm copper clearance (no short).
    const at = neighbor.route.findIndex(
      (p) => p.route_type === "wire" && p.x === 9.5,
    )
    const baseY = 3
    const points: PcbTrace["route"] = []
    for (let step = 1; step < 49; step++) {
      const t = step / 48
      points.push({
        route_type: "wire",
        x: 1 + t * 6,
        y: baseY + 0.8 * Math.sin(Math.PI * t) ** 2,
        width: 0.1,
        layer: "inner1",
      })
    }
    neighbor.route.splice(at, 0, ...points)
    if (rule === "pcb_spacing_to_other_signals") {
      // DQ1 is a neighboring byte lane, outside this declared bus.
      control.bus.source_trace_ids = control.bus.source_trace_ids.filter(
        (id) => id !== control.traces[1]!.source_trace_id,
      )
      changed.bus.source_trace_ids = changed.bus.source_trace_ids.filter(
        (id) => id !== neighbor.source_trace_id,
      )
    }
    // Isolate spacing from timing so the picture has exactly one rule to assess.
    control.bus.max_length_skew = changed.bus.max_length_skew = undefined
  }
  return { control, changed }
}

const escape = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
export function renderDdrComparison(
  rule: VisualRule,
  control: ReturnType<typeof ddrByteLane>,
  changed: ReturnType<typeof ddrByteLane>,
) {
  const parts: string[] = []
  const text = (
    x: number,
    y: number,
    value: string,
    color = "#e5edf6",
    size = 16,
  ) =>
    parts.push(
      `<text x="${x}" y="${y}" fill="${color}" font-family="sans-serif" font-size="${size}">${escape(value)}</text>`,
    )
  parts.push(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="930" viewBox="0 0 1440 930"><rect width="1440" height="930" fill="#0d1722"/>',
  )
  text(32, 36, `DDR byte lane • ${rule.replaceAll("_", " ")}`, "#ffffff", 25)
  text(
    32,
    64,
    "Routed BGA escapes • 0.10 mm traces • top dogbones / inner1 signal layer • DQS partners stay together",
    "#aabbd0",
    15,
  )
  for (const [panel, fixture] of [control, changed].entries()) {
    const left = 24 + panel * 720
    const errors = checkPcbRoutingConstraints(fixture.circuit).filter(
      (e) => e.type === "pcb_bus_routing_constraint_error",
    )
    const highlighted = new Set(
      errors.flatMap((e) => [
        ...e.pcb_trace_ids,
        ...("other_pcb_trace_id" in e ? [e.other_pcb_trace_id] : []),
      ]),
    )
    if (rule === "length_skew" && errors.length) {
      highlighted.clear()
      highlighted.add(fixture.traces[0]!.pcb_trace_id)
    }
    parts.push(
      `<rect x="${left}" y="88" width="692" height="814" rx="12" fill="#162331" stroke="#32465b"/>`,
    )
    text(
      left + 20,
      120,
      panel === 0 ? "CONTROL — PASS" : "MUTATED COPPER — FAIL",
      panel === 0 ? "#84e1a6" : "#ff807a",
      21,
    )
    const prop = {
      length_skew: 'maxLengthSkew="0.635mm"; lengthMatchTo=".DQS"',
      min_length: 'minLength="24.9mm"',
      max_length: 'maxLength="26mm"',
      target_length: 'targetLength="25.05mm" lengthTolerance="0.25mm"',
      pcb_trace_spacing: 'pcbTraceSpacing="0.3mm" (centerline)',
      pcb_spacing_to_other_signals:
        'pcbSpacingToOtherSignals="0.4mm" (centerline)',
    }[rule]
    text(left + 20, 152, prop, "#ffd78a", 15)
    if (rule === "pcb_spacing_to_other_signals")
      text(
        left + 20,
        178,
        "DQ1 belongs to the neighboring byte; it is outside DDR BYTE0.",
        "#c2d2e5",
        14,
      )
    const px = (x: number) => left + 346 + x * 23
    const py = (y: number) => 365 - y * 23
    for (const [label, cx] of [
      ["U1 • DDR controller", -12],
      ["U2 • DDR memory", 12],
    ] as const) {
      parts.push(
        `<rect x="${px(cx) - 39}" y="${py(6)}" width="78" height="${11.8 * 23}" rx="5" fill="#25364a" stroke="#526984"/>`,
      )
      text(px(cx) - 56, py(6) - 12, label, "#c2d2e5", 12)
      for (let row = 0; row < 12; row++)
        for (let col = 0; col < 3; col++)
          parts.push(
            `<circle cx="${px(cx) + (col - 1) * 17}" cy="${py(5.2 - row * 0.9)}" r="3.5" fill="#53677f"/>`,
          )
    }
    fixture.traces.forEach((trace, i) => {
      const color = highlighted.has(trace.pcb_trace_id)
        ? "#ff807a"
        : i >= 8
          ? "#9cc6ff"
          : "#84e1a6"
      let d = ""
      trace.route.forEach((p, index) => {
        if (p.route_type === "through_pad")
          throw new Error("This coupon contains only wires and vias")
        d += `${index === 0 ? "M" : "L"}${px(p.x).toFixed(2)},${py(p.y).toFixed(2)} `
        if (p.route_type === "via")
          parts.push(
            `<circle cx="${px(p.x)}" cy="${py(p.y)}" r="3.5" fill="#0d1722" stroke="${color}" stroke-width="1.8"/>`,
          )
      })
      parts.push(
        `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round"/>`,
      )
      text(
        px(-9.2),
        i < 8 ? py(4 - i) - 7 : 508,
        i < 8 ? `DQ${i}` : i === 8 ? "DQS+/− (0.12 mm gap)" : "",
        color,
        10,
      )
    })
    text(
      left + 20,
      548,
      "Measured pad-to-pad copper (including dogbones)",
      "#c2d2e5",
      16,
    )
    fixture.traces.forEach((trace, i) => {
      const source = fixture.circuit.find(
        (e): e is SourceTrace =>
          e.type === "source_trace" &&
          e.source_trace_id === trace.source_trace_id,
      )!
      const length = measureRoute(source, [trace], fixture.circuit)!.length
      text(
        left + 20 + (i % 5) * 132,
        580 + Math.floor(i / 5) * 27,
        `${source.name}: ${length.toFixed(3)} mm`,
        highlighted.has(trace.pcb_trace_id) ? "#ff807a" : "#c2d2e5",
        13,
      )
    })
    if (rule.includes("spacing")) {
      text(
        left + 20,
        650,
        "3.7× detail • neighboring data traces; no copper overlap",
        "#c2d2e5",
        15,
      )
      parts.push(
        `<rect x="${left + 20}" y="666" width="652" height="120" fill="#0d1722" stroke="#526984"/>`,
      )
      for (const trace of fixture.traces.slice(0, 2)) {
        const points = trace.route.filter(
          (
            p,
          ): p is Extract<PcbTrace["route"][number], { route_type: "wire" }> =>
            p.route_type === "wire" && p.x >= 1 && p.x <= 7,
        )
        if (points.at(-1)?.x !== 7)
          points.push({
            route_type: "wire",
            x: 7,
            y: trace === fixture.traces[0] ? 4 : 3,
            width: 0.1,
            layer: "inner1",
          })
        const d = points
          .map(
            (p, i) =>
              `${i === 0 ? "M" : "L"}${left + 80 + (p.x - 1) * 85},${764 - (p.y - 3) * 85}`,
          )
          .join(" ")
        parts.push(
          `<path d="${d}" stroke="${panel ? "#ff807a" : "#84e1a6"}" stroke-width="8.5" fill="none"/>`,
        )
      }
      text(
        left + 28,
        806,
        panel
          ? "Narrowest centerlines: 0.200 mm (0.100 mm copper gap)"
          : "Centerlines: 1.000 mm (0.900 mm copper gap)",
        panel ? "#ff807a" : "#84e1a6",
        16,
      )
    }
    const finding = errors.find((e) => e.routing_rule === rule)
    let message = "All declared length and signal-spacing rules pass."
    if (finding?.routing_rule === "length_skew")
      message = `FAIL: skew ${finding.actual_length_skew.toFixed(3)} mm > ${finding.maximum_length_skew.toFixed(3)} mm allowed`
    if (finding?.routing_rule === "min_length")
      message = `FAIL: DQ0 ${finding.actual_trace_length.toFixed(3)} mm < ${finding.minimum_trace_length.toFixed(3)} mm minimum`
    if (finding?.routing_rule === "max_length")
      message = `FAIL: DQ0 ${finding.actual_trace_length.toFixed(3)} mm > ${finding.maximum_trace_length.toFixed(3)} mm maximum`
    if (finding?.routing_rule === "target_length")
      message = `FAIL: DQ0 ${finding.actual_trace_length.toFixed(3)} mm outside ${finding.target_trace_length.toFixed(3)} ± ${finding.length_tolerance.toFixed(3)} mm`
    if (finding && "actual_centerline_spacing" in finding)
      message = `FAIL: ${finding.actual_centerline_spacing.toFixed(3)} mm < ${finding.minimum_centerline_spacing.toFixed(3)} mm centerline requirement`
    text(
      left + 20,
      rule.includes("spacing") ? 846 : 676,
      message,
      panel ? "#ff807a" : "#84e1a6",
      17,
    )
    text(
      left + 20,
      880,
      "Copper geometry is identical to the input measured by DRC.",
      "#91a5bc",
      13,
    )
  }
  parts.push("</svg>")
  return parts.join("\n")
}
