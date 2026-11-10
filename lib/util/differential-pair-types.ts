import type {
  AnyCircuitElement,
  PcbBusLengthSkewError,
  SourceBus,
} from "circuit-json"

// Temporary compatibility types for circuit-json 0.0.548. Replace these with
// circuit-json exports once the plural pair variant and lane payload ship.
export type SourceDifferentialPairBus = Pick<
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

export type CircuitJsonWithDifferentialPairs = Array<
  AnyCircuitElement | SourceDifferentialPairBus
>

export type PcbBusLengthSkewErrorWithLaneLengths = PcbBusLengthSkewError & {
  differential_pair_lengths?: {
    positive_length: number
    negative_length: number
  }
}
