import { expect, test } from "bun:test"
import type { PcbPlatedHole, PcbTrace } from "circuit-json"
import { getViaAndPourConnections } from "lib/util/get-via-and-pour-connections"

test("plated-pad connectivity preserves nonzero offsets", () => {
  for (const offsets of [
    { hole_offset_x: 0.6, hole_offset_y: undefined, x: 0.6, y: 0 },
    { hole_offset_x: undefined, hole_offset_y: -0.6, x: 0, y: -0.6 },
    { hole_offset_x: 0.6, hole_offset_y: -0.6, x: 0.6, y: -0.6 },
  ]) {
    const pad: PcbPlatedHole = {
      type: "pcb_plated_hole",
      pcb_plated_hole_id: "pad",
      pcb_port_id: "port",
      shape: "circular_hole_with_rect_pad",
      hole_shape: "circle",
      pad_shape: "rect",
      x: 0,
      y: 0,
      rect_pad_width: 3,
      rect_pad_height: 3,
      hole_diameter: 0.8,
      hole_offset_x: 0,
      hole_offset_y: 0,
      layers: ["top", "bottom"],
    }
    Object.assign(pad, {
      hole_offset_x: offsets.hole_offset_x,
      hole_offset_y: offsets.hole_offset_y,
    })
    const traceAt = (x: number, y: number): PcbTrace => ({
      type: "pcb_trace",
      pcb_trace_id: "trace",
      route: [
        { route_type: "wire", x: x - 0.05, y, width: 0.1, layer: "top" },
        { route_type: "wire", x: x + 0.05, y, width: 0.1, layer: "top" },
      ],
    })
    const originalPad = structuredClone(pad)
    // The displaced drill is empty; the pad's center now contains copper.
    expect(
      getViaAndPourConnections([pad, traceAt(offsets.x, offsets.y)]),
    ).toEqual([])
    expect(getViaAndPourConnections([pad, traceAt(0, 0)])).toEqual([
      ["port", "trace"],
    ])
    expect(pad).toEqual(originalPad)
  }
})
