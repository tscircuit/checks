import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"

type Case = {
  name: string
  x: number
  y: number
  connected: boolean
  layer?: "top" | "bottom"
  reverse?: boolean
  finalWidth?: number
  mode?: PcbTrace["route_thickness_mode"]
  circle?: boolean
  netLevel?: boolean
  unnamed?: boolean
}

test("pad connectivity uses real endpoint copper overlap without accepting gaps", (): void => {
  const cases: Case[] = [
    { name: "unnamed cap", x: -0.13, y: 0.16, connected: true, unnamed: true },
    { name: "unnamed gap", x: -0.18, y: 0, connected: false, unnamed: true },
    { name: "rect corner", x: -0.13, y: 0.16, connected: true },
    { name: "start cap", x: -0.13, y: 0.16, connected: true, reverse: true },
    {
      name: "net-level cap",
      x: -0.13,
      y: 0.16,
      connected: true,
      netLevel: true,
    },
    { name: "circle", x: -0.13, y: 0.08, connected: true, circle: true },
    { name: "corner bounding box only", x: -0.17, y: 0.17, connected: false },
    { name: "tangent", x: -0.179, y: 0, connected: false },
    { name: "gap", x: -0.18, y: 0, connected: false },
    {
      name: "other layer",
      x: -0.13,
      y: 0.16,
      connected: false,
      layer: "bottom",
    },
    {
      name: "incoming segment width",
      x: -0.2,
      y: 0,
      connected: false,
      finalWidth: 1,
    },
    {
      name: "interpolated remains conservative",
      x: -0.13,
      y: 0.16,
      connected: false,
      mode: "interpolated",
    },
  ]
  for (const c of cases) {
    const layer = c.layer ?? "top"
    const route: PcbTrace["route"] = [
      { route_type: "wire", x: -1, y: 0.3, layer, width: 0.15 },
      { route_type: "wire", x: c.x, y: 0.3, layer, width: 0.15 },
      {
        route_type: "wire",
        x: c.x,
        y: c.y,
        layer,
        width: c.finalWidth ?? 0.15,
      },
    ]
    if (c.reverse) route.reverse()
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_port",
        source_port_id: "source_anchor",
        name: "anchor",
        port_hints: ["anchor"],
      },
      {
        type: "source_port",
        source_port_id: "source_signal",
        name: c.unnamed ? "" : "SCL",
        port_hints: c.unnamed ? [] : ["SCL"],
      },
      {
        type: "source_trace",
        source_trace_id: "source_connection",
        connected_source_port_ids: c.netLevel
          ? []
          : ["source_anchor", "source_signal"],
        connected_source_net_ids: [],
      },
      {
        type: "pcb_port",
        pcb_port_id: "port_anchor",
        source_port_id: "source_anchor",
        x: -1,
        y: 0.3,
        layers: [layer],
      },
      {
        type: "pcb_port",
        pcb_port_id: "port_signal",
        source_port_id: "source_signal",
        x: 0,
        y: 0,
        layers: ["top"],
      },
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "pad_anchor",
        pcb_port_id: "port_anchor",
        shape: "rect",
        x: -1,
        y: 0.3,
        width: 0.3,
        height: 0.3,
        layer,
      },
      c.circle
        ? {
            type: "pcb_smtpad",
            pcb_smtpad_id: "pad_signal",
            pcb_port_id: "port_signal",
            shape: "circle",
            x: 0,
            y: 0,
            radius: 0.104,
            layer: "top",
          }
        : {
            type: "pcb_smtpad",
            pcb_smtpad_id: "pad_signal",
            pcb_port_id: "port_signal",
            shape: "rect",
            x: 0,
            y: 0,
            width: 0.208,
            height: 0.208,
            layer: "top",
          },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_connection",
        source_trace_id: "source_connection",
        route,
        route_thickness_mode: c.mode,
      },
    ]
    const errors = checkTracesAreContiguous(circuitJson)
    expect(errors.length, c.name).toBe(c.connected ? 0 : 1)
    for (const error of errors) {
      expect(error.message).not.toContain("port_signal")
      expect(error.message).not.toContain("pad_signal")
    }
  }
})
