import { expect, test } from "bun:test"
import { checkViaTraceClearance } from "../../lib/check-via-trace-clearance"
import type { AnyCircuitElement } from "circuit-json"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"

test("via clearance bounds retain near, thick, layer and overlap-suppression cases", (): void => {
  for (const { height, width, layer, sameNet, expectedErrors } of [
    {
      height: 0.4,
      width: 0.1,
      layer: "top",
      sameNet: false,
      expectedErrors: 1,
    },
    {
      height: 0.45,
      width: 0.1,
      layer: "top",
      sameNet: false,
      expectedErrors: 0,
    },
    {
      height: 0.4449,
      width: 0.1,
      layer: "top",
      sameNet: false,
      expectedErrors: 1,
    },
    {
      height: 0.4451,
      width: 0.1,
      layer: "top",
      sameNet: false,
      expectedErrors: 0,
    },
    {
      height: 0.79,
      width: 0.8,
      layer: "top",
      sameNet: false,
      expectedErrors: 1,
    },
    {
      height: 0.4,
      width: 0.1,
      layer: "bottom",
      sameNet: false,
      expectedErrors: 0,
    },
    { height: 0.4, width: 0.1, layer: "top", sameNet: true, expectedErrors: 0 },
    {
      height: 100,
      width: 0.1,
      layer: "top",
      sameNet: false,
      expectedErrors: 0,
    },
  ]) {
    const circuitJson = [
      {
        type: "pcb_via",
        pcb_via_id: "via",
        x: 0,
        y: 0,
        outer_diameter: 0.6,
        hole_diameter: 0.3,
        layers: ["top"],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace",
        route: [
          { route_type: "wire", x: -2, y: height, width, layer },
          { route_type: "wire", x: 2, y: height, width, layer },
        ],
      },
    ] as AnyCircuitElement[]
    const connMap = new ConnectivityMap(
      sameNet ? { net: ["via", "trace"] } : { via: ["via"], trace: ["trace"] },
    )
    const errors = checkViaTraceClearance(circuitJson, {
      connMap,
      minClearance: 0.1,
    })
    expect(errors).toHaveLength(expectedErrors)
    if (expectedErrors > 0) {
      expect(errors[0].pcb_via_id).toBe("via")
      expect(errors[0].pcb_trace_id).toBe("trace")
      expect(errors[0].minimum_clearance).toBe(0.1)
    }
    if (height === 0.4 && !sameNet && layer === "top") {
      // A later overlap suppresses the earlier clearance warning for this pair.
      const trace = circuitJson[1] as AnyCircuitElement & {
        route: Array<Record<string, unknown>>
      }
      trace.route.push(
        { route_type: "wire", x: 2, y: 0, width, layer },
        { route_type: "wire", x: -2, y: 0, width, layer },
      )
      expect(
        checkViaTraceClearance(circuitJson, { connMap, minClearance: 0.1 }),
      ).toHaveLength(0)
    }
  }
})
