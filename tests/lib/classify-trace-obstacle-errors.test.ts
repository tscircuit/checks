import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkPadTraceClearance } from "lib/check-pad-trace-clearance"
import { checkViaTraceClearance } from "lib/check-via-trace-clearance"
import { runAllChecks, runAllRoutingChecks } from "lib/run-all-checks"

test("trace-obstacle checks classify each pair as overlap or clearance", async () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_clearance",
      shape: "rect",
      x: -0.75,
      y: 0.2,
      width: 0.2,
      height: 0.2,
      layer: "top",
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad_overlap",
      shape: "rect",
      x: -0.25,
      y: 0.1,
      width: 0.2,
      height: 0.2,
      layer: "top",
    },
    {
      type: "pcb_via",
      pcb_via_id: "via_clearance",
      x: 0.25,
      y: 0.3,
      hole_diameter: 0.2,
      outer_diameter: 0.4,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_via",
      pcb_via_id: "via_overlap",
      x: 0.75,
      y: 0.2,
      hole_diameter: 0.2,
      outer_diameter: 0.4,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace1",
      route: [
        { route_type: "wire", x: -1, y: 0, width: 0.1, layer: "top" },
        { route_type: "wire", x: 1, y: 0, width: 0.1, layer: "top" },
      ],
    },
  ]

  const overlapErrors = checkEachPcbTraceNonOverlapping(circuitJson)
  const padClearanceErrors = checkPadTraceClearance(circuitJson)
  const viaClearanceErrors = checkViaTraceClearance(circuitJson)
  const errors = await runAllChecks(circuitJson)
  const routingErrors = await runAllRoutingChecks(circuitJson)

  expect(overlapErrors.map((error) => error.pcb_trace_error_id).sort()).toEqual(
    ["overlap_trace1_pad_overlap", "overlap_trace1_via_overlap"],
  )
  expect(padClearanceErrors.map((error) => error.pcb_pad_id)).toEqual([
    "pad_clearance",
  ])
  expect(viaClearanceErrors.map((error) => error.pcb_via_id)).toEqual([
    "via_clearance",
  ])

  const classifiedPairIds = (errors as Array<Record<string, unknown>>)
    .filter(
      (error) =>
        error.type === "pcb_pad_trace_clearance_error" ||
        error.type === "pcb_via_trace_clearance_error" ||
        (error.type === "pcb_trace_error" &&
          (error.pcb_trace_error_id as string).startsWith("overlap_")),
    )
    .map((error) =>
      error.type === "pcb_trace_error"
        ? (error.pcb_trace_error_id as string).replace(/^overlap_/, "")
        : `${error.pcb_trace_id}_${error.pcb_pad_id ?? error.pcb_via_id}`,
    )

  expect(classifiedPairIds).toHaveLength(4)
  expect(new Set(classifiedPairIds).size).toBe(4)
  expect(routingErrors as AnyCircuitElement[]).toEqual(errors)
})
