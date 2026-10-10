import type { AnyCircuitElement } from "circuit-json"
import circuitJson from "../assets/disconnected-pcb-net.circuit.json"

// Emitted by @tscircuit/core@0.0.2124 with bridge=false from:
// https://github.com/tscircuit/core/blob/e8a5dc81302310d300bd35c146407b32f829c4e5/tests/repros/repro-same-net-copper-islands.test.tsx
export const disconnectedPcbNet = circuitJson as AnyCircuitElement[]
