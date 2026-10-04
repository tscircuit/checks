import { expect, test } from "bun:test"
import { Utils } from "@flatten-js/core"
import type { AnyCircuitElement } from "circuit-json"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { createIndexedPcbConnectivityMap } from "lib/util/create-indexed-pcb-connectivity-map"
import { getViaAndPourConnections } from "lib/util/get-via-and-pour-connections"
import { PcbConnectivityGeometryCache } from "lib/util/pcb-connectivity-geometry-cache"
import { fixture } from "../repros/via-barrel-fixture"

test("geometry reuse preserves graph and continuity while geometry and topology change", () => {
  const cache = new PcbConnectivityGeometryCache()
  const originalTolerance = Utils.getTolerance()
  const circuit: AnyCircuitElement[] = structuredClone(fixture)
  const compare = (): void => {
    const original = JSON.stringify(circuit)
    expect(getViaAndPourConnections(circuit, cache)).toEqual(
      getViaAndPourConnections(circuit),
    )
    const expected = createIndexedPcbConnectivityMap(circuit)
    const actual = createIndexedPcbConnectivityMap(circuit, cache)
    expect(actual.connMap.netMap).toEqual(expected.connMap.netMap)
    expect(actual.connMap.idToNetMap).toEqual(expected.connMap.idToNetMap)
    expect(checkTracesAreContiguous(circuit, { connectivityGeometryCache: cache })).toEqual(
      checkTracesAreContiguous(circuit),
    )
    expect(JSON.stringify(circuit)).toBe(original)
  }
  try {
    compare()
    compare()
    expect(cache.getStats().hits).toBeGreaterThan(0)
    // Different conductors may reuse exactly the same internally owned polygon.
    for (const element of [...circuit]) {
      if (element.type === "pcb_via") {
        circuit.push({ ...element, pcb_via_id: `${element.pcb_via_id}_duplicate` })
      }
      if (element.type === "pcb_trace") {
        circuit.push({ ...structuredClone(element), pcb_trace_id: `${element.pcb_trace_id}_duplicate` })
      }
    }
    compare()
    for (let step = 0; step < 36; step++) {
      for (const element of circuit) {
        if (element.type === "pcb_trace") {
          for (const point of element.route) {
            if (point.route_type === "wire") {
              point.x += (step % 3 - 1) * 0.03
              point.y = step % 5 === 0 ? -0 : (step % 4) * 0.001
              point.width = step % 6 === 0 ? 0.3 : 0.1
              if (step % 7 === 0) point.layer = point.layer === "top" ? "bottom" : "top"
            }
            if (point.route_type === "via") {
              point.x += (step % 3 - 1) * 0.02
              point.outer_diameter = step % 4 === 0 ? 0.31 : 0.3
              point.to_layer = step % 5 === 0 ? "inner1" : "bottom"
            }
          }
          if (step % 8 === 0) element.pcb_trace_id = `${element.pcb_trace_id}_next`
        }
        if (element.type === "pcb_via") {
          element.x += (step % 3 - 1) * 0.02
          element.outer_diameter = step % 4 === 0 ? 0.31 : 0.3
          element.layers = step % 5 === 0 ? ["top", "inner1"] : ["top", "inner1", "inner2", "bottom"]
          element.pcb_trace_id = step % 6 === 0 ? undefined : "via_trace_1"
        }
        if (element.type === "pcb_board") element.num_layers = step % 5 === 0 ? 2 : 4
      }
      compare()
    }
    // Pours remain live and uncached, including their holes and rotation.
    const pour = {
      type: "pcb_copper_pour", pcb_copper_pour_id: "live_pour", layer: "top",
      shape: "rect", center: { x: 2, y: 0 }, width: 4, height: 0.2, rotation: 0,
    } as AnyCircuitElement
    circuit.push(pour)
    compare()
    const holePour = {
      type: "pcb_copper_pour", pcb_copper_pour_id: "live_hole_pour", layer: "top",
      shape: "brep", brep_shape: {
        outer_ring: { vertices: [{ x: -1, y: -1 }, { x: 5, y: -1 }, { x: 5, y: 1 }, { x: -1, y: 1 }] },
        inner_rings: [{ vertices: [{ x: 1, y: -0.5 }, { x: 3, y: -0.5 }, { x: 3, y: 0.5 }, { x: 1, y: 0.5 }] }],
      },
    } as AnyCircuitElement
    circuit.push(holePour)
    compare()
    if (holePour.type === "pcb_copper_pour" && holePour.shape === "brep") {
      holePour.brep_shape.inner_rings[0].vertices[0].x += 0.2
    }
    compare()
    if (pour.type === "pcb_copper_pour" && pour.shape === "rect") {
      pour.center.x = 20
      pour.rotation = 37
    }
    compare()
    circuit.reverse()
    compare()
    // Flatten's global tolerance participates in polygon construction.
    circuit.splice(0, circuit.length, ...structuredClone(fixture))
    for (const tolerance of [originalTolerance, 0, originalTolerance]) {
      Utils.setTolerance(tolerance)
      compare()
    }
  } finally {
    Utils.setTolerance(originalTolerance)
  }
})
