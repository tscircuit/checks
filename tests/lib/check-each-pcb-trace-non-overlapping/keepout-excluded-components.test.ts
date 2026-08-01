import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import type { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"

test("keepout component exclusions suppress only connected trace violations", () => {
  const circuitJson = [
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_excluded",
      route: [
        { route_type: "wire", x: -3, y: 0, width: 0.1, layer: "top" },
        { route_type: "wire", x: 3, y: 0, width: 0.1, layer: "top" },
      ],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace_reported",
      route: [
        { route_type: "wire", x: -3, y: 1, width: 0.1, layer: "top" },
        { route_type: "wire", x: 3, y: 1, width: 0.1, layer: "top" },
      ],
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_ant1",
      pcb_component_id: "pcb_component_ant1",
      shape: "rect",
      x: -10,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    {
      type: "pcb_keepout",
      shape: "rect",
      pcb_keepout_id: "keepout_antenna",
      center: { x: 0, y: 0 },
      width: 4,
      height: 4,
      layers: ["top"],
      excluded_pcb_component_ids: ["pcb_component_ant1"],
    },
  ] as AnyCircuitElement[]

  const connMap = {
    areIdsConnected: (idA: string, idB: string) => {
      if (idA === idB) return true
      return (
        (idA === "trace_excluded" && idB === "pad_ant1") ||
        (idA === "pad_ant1" && idB === "trace_excluded")
      )
    },
  } as unknown as ConnectivityMap

  const errors = checkEachPcbTraceNonOverlapping(circuitJson, {
    connMap,
    minClearance: 0,
  })
  expect(errors.map((error) => error.pcb_trace_id)).toEqual(["trace_reported"])
  expect(errors[0]?.pcb_trace_error_id).toBe(
    "overlap_trace_reported_keepout_antenna",
  )
})
