import type { AnyCircuitElement, PcbTrace, SourceBus } from "circuit-json"

// Pending circuit-json's plural, lane-based differential-pair variant.
export type PairBus = Pick<
  SourceBus,
  "type" | "source_bus_id" | "name" | "subcircuit_id"
> & {
  source_trace_ids: [string, ...string[]]
  max_length_skew: number
  differential_pair: {
    positive_source_trace_ids: [string, ...string[]]
    negative_source_trace_ids: [string, ...string[]]
  }
}

export function pairFixture(
  positive: number[],
  negative: number[],
  maxLengthSkew = 0.1,
) {
  const circuit: AnyCircuitElement[] = []
  const traces: PcbTrace[] = []
  const addLane = (lengths: number[], lane: string, y: number) => {
    let x = 0
    return lengths.map((length, i) => {
      const name = `${lane}${i + 1}`
      const id = `source_trace_${name}`
      circuit.push({
        type: "source_trace",
        source_trace_id: id,
        name,
        connected_source_port_ids: [`${id}_a`, `${id}_b`],
        connected_source_net_ids: [],
      })
      for (const [suffix, px] of [
        ["a", x],
        ["b", x + length],
      ] as const) {
        circuit.push({
          type: "pcb_port",
          pcb_port_id: `pcb_port_${name}_${suffix}`,
          source_port_id: `${id}_${suffix}`,
          x: px,
          y,
          layers: ["top", "bottom"],
        })
      }
      const trace: PcbTrace = {
        type: "pcb_trace",
        pcb_trace_id: `pcb_trace_${name}`,
        source_trace_id: id,
        route: [x, x + length].map((px) => ({
          route_type: "wire",
          x: px,
          y,
          width: 0.2,
          layer: "top",
        })),
      }
      traces.push(trace)
      circuit.push(trace)
      x += length + 1 // Component gaps contribute no copper.
      return id
    }) as [string, ...string[]]
  }
  const positiveIds = addLane(positive, "P", 2)
  const negativeIds = addLane(negative, "N", -2)
  const bus: PairBus = {
    type: "source_bus",
    source_bus_id: "source_bus_usb",
    name: "USB",
    subcircuit_id: "subcircuit_board",
    source_trace_ids: [...positiveIds, ...negativeIds],
    max_length_skew: maxLengthSkew,
    differential_pair: {
      positive_source_trace_ids: positiveIds,
      negative_source_trace_ids: negativeIds,
    },
  }
  // Only the fixture's input boundary bridges the not-yet-released schema.
  circuit.push(bus as unknown as SourceBus)
  return { circuit, bus, traces, positiveIds, negativeIds }
}
