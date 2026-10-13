import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace, PcbVia } from "circuit-json"
import { getViaAndPourConnections } from "lib/util/get-via-and-pour-connections"

test("indexed wire capsules retain rounded-end contacts, incoming widths and layers", () => {
  for (const offset of [0, 10000]) {
    for (const angle of [-Math.PI / 3, 0, Math.PI / 3]) {
      for (const gap of [-1e-6, 1e-6]) {
        for (const layer of ["top", "inner1"] as const) {
          const trace: PcbTrace = {
            type: "pcb_trace",
            pcb_trace_id: "wire",
            route: [
              { route_type: "wire", x: offset - 2, y: offset, width: 0.2, layer: "top" },
              { route_type: "wire", x: offset, y: offset, width: 0.001, layer: "top" },
            ],
          }
          const via: PcbVia = {
            type: "pcb_via",
            pcb_via_id: "via",
            x: offset + Math.cos(angle) * (0.3 + gap),
            y: offset + Math.sin(angle) * (0.3 + gap),
            outer_diameter: 0.4,
            hole_diameter: 0.2,
            layers: [layer],
          }
          const circuit: AnyCircuitElement[] = [trace, via]
          const original = structuredClone(circuit)
          expect(getViaAndPourConnections(circuit)).toEqual(
            gap < 0 && layer === "top" ? [["via", "wire"]] : [],
          )
          expect(circuit).toEqual(original)
        }
      }
    }
  }
})
