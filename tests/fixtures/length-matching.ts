import type { PcbTrace, SourceBus } from "circuit-json"

export const bus = (skew: number | undefined = 1): SourceBus => ({
  type: "source_bus",
  source_bus_id: "bus",
  source_trace_ids: ["a", "b"],
  max_length_skew: skew,
  subcircuit_id: "board",
})
export const trace = (id: string, length: number): PcbTrace => ({
  type: "pcb_trace",
  pcb_trace_id: `pcb_${id}`,
  source_trace_id: id,
  trace_length: length,
  route: [],
})
