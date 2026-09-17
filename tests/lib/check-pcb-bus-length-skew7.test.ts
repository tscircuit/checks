import { expect, test } from "bun:test"
import {
  any_circuit_element,
  type AnyCircuitElement,
  type PcbTrace,
  type SourceBus,
} from "circuit-json"
import { checkPcbBusLengthSkew, runAllRoutingChecks } from "../.."
import { getPcbTraceLength } from "../../lib/util/get-pcb-trace-length"

import { bus, trace } from "../fixtures/length-matching"

test("matches exact endpoints without including unrelated branches", () => {
  const source: AnyCircuitElement = {
    type: "source_trace",
    source_trace_id: "a",
    connected_source_port_ids: ["s1", "s2"],
    connected_source_net_ids: [],
  }
  const ports: AnyCircuitElement[] = [1, 2, 3].map((i) => ({
    type: "pcb_port",
    pcb_port_id: `p${i}`,
    source_port_id: `s${i}`,
    pcb_component_id: `c${i}`,
    x: 0,
    y: 0,
    layers: ["top"],
  }))
  const routed = (id: string, end: string, length: number): PcbTrace => ({
    ...trace("a", length),
    pcb_trace_id: id,
    route: [
      {
        route_type: "wire",
        x: 0,
        y: 0,
        layer: "top",
        width: 0.2,
        start_pcb_port_id: "p1",
      },
      {
        route_type: "wire",
        x: length,
        y: 0,
        layer: "top",
        width: 0.2,
        end_pcb_port_id: end,
      },
    ],
  })
  expect(
    checkPcbBusLengthSkew([
      bus(0),
      source,
      ...ports,
      routed("exact", "p2", 10),
      routed("branch", "p3", 100),
      trace("b", 10),
    ]),
  ).toEqual([])
})
