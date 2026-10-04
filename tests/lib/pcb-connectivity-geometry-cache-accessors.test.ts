import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { getViaAndPourConnections } from "lib/util/get-via-and-pour-connections"
import { PcbConnectivityGeometryCache } from "lib/util/pcb-connectivity-geometry-cache"

type GetterReplay = { circuit: AnyCircuitElement[]; reads: string[] }

function createGetterReplay(): GetterReplay {
  const reads: string[] = []
  const point = { route_type: "wire", x: 0, y: 0, width: 0.1, layer: "top" }
  Object.defineProperty(point, "x", {
    enumerable: true,
    get(): number {
      reads.push("wire.x")
      return reads.length % 2 === 0 ? 0.001 : 0
    },
  })
  const via = {
    type: "pcb_via",
    pcb_via_id: "via",
    x: 0,
    y: 0,
    outer_diameter: 0.3,
    hole_diameter: 0.1,
    layers: ["top", "bottom"],
  }
  Object.defineProperty(via, "outer_diameter", {
    enumerable: true,
    get(): number {
      reads.push("via.diameter")
      return reads.length % 2 === 0 ? 0.31 : 0.3
    },
  })
  const circuit = [
    via,
    {
      type: "pcb_trace",
      pcb_trace_id: "trace",
      route: [point, { ...point, x: 1 }],
    },
  ] as AnyCircuitElement[]
  reads.length = 0
  return { circuit, reads }
}

test("accessor geometry retains constructor reads on every cached evaluation", () => {
  const cache = new PcbConnectivityGeometryCache()
  for (let pass = 0; pass < 8; pass++) {
    const expected = createGetterReplay()
    const actual = createGetterReplay()
    expect(getViaAndPourConnections(actual.circuit, cache)).toEqual(
      getViaAndPourConnections(expected.circuit),
    )
    expect(actual.reads).toEqual(expected.reads)
  }
  expect(cache.getStats()).toEqual({ hits: 0, misses: 0, entries: 0 })
})
