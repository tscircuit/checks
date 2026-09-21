import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { PcbConnectivityMap } from "circuit-json-to-connectivity-map"
import { createIndexedPcbConnectivityMap } from "lib/util/create-indexed-pcb-connectivity-map"

const wire = (
  x: number,
  y: number,
  width = 0.2,
  layer: "top" | "bottom" = "top",
) => ({ route_type: "wire", x, y, width, layer }) as const
const trace = (id: string, route: PcbTrace["route"]): PcbTrace => ({
  type: "pcb_trace",
  pcb_trace_id: id,
  route,
})

function compareMaps(circuit: AnyCircuitElement[]) {
  const original = structuredClone(circuit)
  const expected = new PcbConnectivityMap(circuit)
  const actual = createIndexedPcbConnectivityMap(circuit)
  expect(actual.connMap.netMap).toEqual(expected.connMap.netMap)
  for (const id of expected.traceIdToElm.keys()) {
    expect(actual.getAllTracesConnectedToTrace(id)).toEqual(
      expected.getAllTracesConnectedToTrace(id),
    )
  }
  for (const id of expected.portIdToElm.keys()) {
    expect(actual.getAllTracesConnectedToPort(id)).toEqual(
      expected.getAllTracesConnectedToPort(id),
    )
  }
  expect(circuit).toEqual(original)
  return actual
}

test("indexed connectivity preserves widths, layers, endpoint links and isolated traces", () => {
  compareMaps([])
  const circuit: AnyCircuitElement[] = [
    trace("empty", []),
    trace("single", [wire(100, 100)]),
    trace("a", [wire(0, 0, 0.4), wire(2, 0)]),
    trace("touching", [wire(0, 0.3), wire(2, 0.3)]),
    trace("separated", [wire(0, -0.301), wire(2, -0.301)]),
    trace("other-layer", [
      wire(0, 0, 0.2, "bottom"),
      wire(2, 0, 0.2, "bottom"),
    ]),
    trace("point", [wire(1, 0), wire(1, 0)]),
    trace("zero-width", [wire(1, -1, 0), wire(1, 1, 0)]),
    trace("layer-transition", [wire(30, 0), wire(40, 0, 0.2, "bottom")]),
    trace("transition-crossing", [wire(35, -1), wire(35, 1)]),
    trace("via", [
      wire(20, 0),
      { route_type: "via", x: 20, y: 0, from_layer: "top", to_layer: "bottom" },
      wire(20, 0, 0.2, "bottom"),
      wire(21, 0, 0.2, "bottom"),
    ]),
    trace("port-linked", [
      { ...wire(50, 0), start_pcb_port_id: "p1", end_pcb_port_id: "p2" },
    ]),
    trace("same-port", [
      { ...wire(70, 0), start_pcb_port_id: "p2", end_pcb_port_id: "p2" },
    ]),
    ...["p1", "p2"].map((id) => ({
      type: "pcb_port" as const,
      pcb_port_id: id,
      pcb_component_id: "component",
      source_port_id: `source_${id}`,
      x: 50,
      y: 0,
      layers: ["top" as const],
    })),
  ]
  const map = compareMaps(circuit)
  expect(map.areTracesConnected("a", "touching")).toBe(true)
  expect(map.areTracesConnected("a", "other-layer")).toBe(false)
  expect(
    map.areTracesConnected("layer-transition", "transition-crossing"),
  ).toBe(false)
  expect(map.areTracesConnected("port-linked", "same-port")).toBe(true)
})

test("indexed connectivity matches all-pairs geometry for deterministic random routes", () => {
  let seed = 12345
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32
  for (let batch = 0; batch < 20; batch++) {
    const traces = Array.from({ length: 40 }, (_, i) =>
      trace(
        `t${i}`,
        Array.from({ length: 5 }, () =>
          wire(
            random() * 20,
            random() * 20,
            random(),
            random() < 0.7 ? "top" : "bottom",
          ),
        ),
      ),
    )
    compareMaps(traces)
  }
})
