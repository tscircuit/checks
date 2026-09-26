import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace, PcbVia } from "circuit-json"
import { getViaAndPourConnections } from "lib/util/get-via-and-pour-connections"

test("via barrels near rounded trace ends connect only when their copper touches", () => {
  const trace: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "trace",
    route: [
      { route_type: "wire", x: -2, y: 0, width: 1, layer: "top" },
      { route_type: "wire", x: 0, y: 0, width: 1, layer: "top" },
    ],
  }
  for (const embedded of [false, true]) {
    for (const coordinate of [0.49, 0.4]) {
      const via: PcbVia = {
        type: "pcb_via",
        pcb_via_id: "via",
        x: coordinate,
        y: coordinate,
        outer_diameter: 0.2,
        hole_diameter: 0.1,
        layers: ["top", "bottom"],
      }
      const circuit: AnyCircuitElement[] = [trace]
      if (embedded) {
        circuit.push({
          type: "pcb_trace",
          pcb_trace_id: "via_trace",
          route: [
            {
              route_type: "via",
              x: coordinate,
              y: coordinate,
              from_layer: "top",
              to_layer: "bottom",
              outer_diameter: 0.2,
              hole_diameter: 0.1,
            },
          ],
        })
      } else {
        circuit.push(via)
      }
      expect(getViaAndPourConnections(circuit)).toEqual(
        coordinate === 0.49 ? [] : [[embedded ? "via_trace" : "via", "trace"]],
      )
    }
  }
})
