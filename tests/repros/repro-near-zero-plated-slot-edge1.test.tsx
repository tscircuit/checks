import { expect, test } from "bun:test"
import { Utils } from "@flatten-js/core"
import { getPlatedHolePolygon } from "@tscircuit/circuit-json-util"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { circuitJson } from "./near-zero-plated-slot-edge-fixture"

test("native slotted-pad input and visual context", async () => {
  expect(circuitJson.filter((e) => e.type.endsWith("_error"))).toEqual([])
  const hole = circuitJson.find((e) => e.type === "pcb_plated_hole")!
  const polygon = getPlatedHolePolygon(hole).scale(1e6, 1e6)
  expect(
    [...polygon.edges].some((e) => e.length > 0 && Utils.EQ_0(e.length)),
  ).toBe(true)
  for (const [name, viewport] of [
    ["near-zero-slot-overview", { minX: -2, maxX: 3, minY: 17.8, maxY: 23.2 }],
    [
      "near-zero-slot-detail",
      { minX: -0.7, maxX: 0.9, minY: 19.3, maxY: 20.7 },
    ],
  ] as const) {
    await expect(
      convertCircuitJsonToPcbSvg(circuitJson, {
        width: 900,
        height: 800,
        layer: "bottom",
        viewport,
        xRayElementIds: circuitJson
          .filter((e) => e.type === "pcb_trace")
          .map((e) => e.pcb_trace_id),
        backgroundColor: "white",
        includeVersion: false,
      }),
    ).toMatchSvgSnapshot(import.meta.path, name)
  }
})
