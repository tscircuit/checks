import type { getLayersOfPcbElement } from "../util/getLayersOfPcbElement"
import type { PcbTrace, PcbVia } from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"

export type PcbTraceId = PcbTrace["pcb_trace_id"]
export type PcbViaId = PcbVia["pcb_via_id"]
export type ConnectivityNetId = NonNullable<
  ReturnType<ConnectivityMap["getNetConnectedToId"]>
>
export type PcbCopperLayer = ReturnType<typeof getLayersOfPcbElement>[number]

/** Tolerance in mm for copper contact and zero-length segments. */
export const CONTACT_EPSILON_MM = 1e-9
