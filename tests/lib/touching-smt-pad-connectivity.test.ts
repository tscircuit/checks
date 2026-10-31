import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbSmtPad } from "circuit-json"
import { createIndexedPcbConnectivityMap } from "lib/util/create-indexed-pcb-connectivity-map"

// All coordinates are board-world millimeters. Only A is named by the trace.
const pad = (
  id: string,
  x: number,
  y: number,
  layer: "top" | "bottom" = "top",
): Extract<PcbSmtPad, { x: number }> => ({
  type: "pcb_smtpad",
  pcb_smtpad_id: `pad_${id}`,
  pcb_port_id: id,
  pcb_component_id: "component",
  shape: "rect",
  x,
  y,
  width: 1,
  height: 1,
  layer,
})

test("SMT contact chains require actual copper contact on a shared layer", () => {
  const cases: { label: string; pads: Extract<PcbSmtPad, { x: number }>[]; connected: boolean }[] = [
    {
      label: "coincident",
      pads: [pad("A", 0, 0), pad("B", 0, 0)],
      connected: true,
    },
    {
      label: "overlap",
      pads: [pad("A", 0, 0), pad("B", 0.8, 0)],
      connected: true,
    },
    {
      label: "edge contact",
      pads: [pad("A", 0, 0), pad("B", 1, 0)],
      connected: true,
    },
    {
      label: "gap",
      pads: [pad("A", 0, 0), pad("B", 1.001, 0)],
      connected: false,
    },
    {
      label: "opposite layers",
      pads: [pad("A", 0, 0), pad("B", 0, 0, "bottom")],
      connected: false,
    },
    {
      label: "transitive shared copper",
      pads: [pad("A", 0, 0), pad("C", 0.8, 0), pad("B", 1.6, 0)],
      connected: true,
    },
    {
      label: "round bounds overlap without copper",
      pads: ["A", "B"].map((id, i) => ({
        type: "pcb_smtpad",
        pcb_smtpad_id: `pad_${id}`,
        pcb_port_id: id,
        pcb_component_id: "component",
        shape: "circle",
        x: i * 0.8,
        y: i * 0.8,
        radius: 0.5,
        layer: "top",
      })),
      connected: false,
    },
  ]
  for (const { label, pads, connected } of cases) {
    const circuit: AnyCircuitElement[] = [
      ...pads,
      ...pads.map((p) => ({
        type: "pcb_port" as const,
        pcb_port_id: p.pcb_port_id!,
        pcb_component_id: "component",
        source_port_id: `source_${p.pcb_port_id}`,
        x: p.x,
        y: p.y,
        layers: [p.layer],
      })),
      {
        type: "pcb_trace",
        pcb_trace_id: "trace",
        route: [
          {
            route_type: "wire",
            x: 0,
            y: 0,
            width: 0.2,
            layer: "top",
            start_pcb_port_id: "A",
          },
          { route_type: "wire", x: -2, y: 0, width: 0.2, layer: "top" },
        ],
      },
    ]
    const before = structuredClone(circuit)
    const map = createIndexedPcbConnectivityMap(circuit)
    expect(map.getAllTracesConnectedToPort("B").length > 0, label).toBe(
      connected,
    )
    expect(circuit).toEqual(before)
  }
})
