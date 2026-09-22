import type { getLayersOfPcbElement } from "../util/getLayersOfPcbElement"
import type { PcbTrace, PcbVia } from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"

export type PcbTraceId = PcbTrace["pcb_trace_id"]
export type PcbViaId = PcbVia["pcb_via_id"]
export type PcbTraceLayer = Extract<
  PcbTrace["route"][number],
  { route_type: "wire" }
>["layer"]
export type ConnectivityNetId = NonNullable<
  ReturnType<ConnectivityMap["getNetConnectedToId"]>
>

export type PcbCopperLayer = ReturnType<typeof getLayersOfPcbElement>[number]
