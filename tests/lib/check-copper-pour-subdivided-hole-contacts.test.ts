import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkCopperPourShorts } from "../../lib/check-copper-pour-shorts"
import { createPourHoleCircuit } from "../fixtures/collinear-pour-hole"

test("subdivided holes keep genuine pad contacts and layer/net exclusions", (): void => {
  for (const reverse of [false, true]) {
    for (const x of [-3.4, -2.9, -2.85, -2.8, -0.25, 2.8, 2.85, 2.9, 3.4]) {
      const circuit = createPourHoleCircuit({
        collinearVertices: true,
        padX: x,
      })
      const pour = circuit.find(
        (element) => element.type === "pcb_copper_pour",
      )!
      if (pour.type !== "pcb_copper_pour" || pour.shape !== "brep") {
        throw new Error("Expected the BRep pour fixture")
      }
      if (reverse) pour.brep_shape.inner_rings[0].vertices.reverse()
      const pad = circuit.find((element) => element.type === "pcb_smtpad")!
      if (pad.type !== "pcb_smtpad" || pad.shape !== "rect") {
        throw new Error("Expected the rectangular pad fixture")
      }
      pad.width = 0.3
      // At +/-2.85 the pad touches the hole wall. A slight overlap and pads
      // wholly in copper must also report contact, in either ring winding.
      expect(checkCopperPourShorts(circuit)).toHaveLength(
        Math.abs(x) >= 2.85 ? 1 : 0,
      )
      pad.layer = "bottom"
      expect(checkCopperPourShorts(circuit)).toEqual([])
      pad.layer = "top"
      const connected: AnyCircuitElement[] = [
        ...circuit,
        {
          type: "source_trace",
          source_trace_id: "ground_connection",
          connected_source_port_ids: ["signal_source_port"],
          connected_source_net_ids: ["ground"],
        },
      ]
      expect(checkCopperPourShorts(connected)).toEqual([])
    }
  }
})
