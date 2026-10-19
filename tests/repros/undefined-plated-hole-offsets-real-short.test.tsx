import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { runAllRoutingChecks } from "lib/run-all-checks"
import { undefinedPlatedHoleOffsetsFixture } from "../fixtures/undefined-plated-hole-offsets"

test("routing DRC still reports shorts with undefined plated-hole offsets", async () => {
  const circuitJson = await undefinedPlatedHoleOffsetsFixture()
  const trace = circuitJson.find((element) => element.type === "pcb_trace")!
  // Deliberately route through the other, unconnected pin of J1.
  trace.route.splice(1, 0, {
    route_type: "wire",
    x: 2.5,
    y: 0,
    width: 0.15,
    layer: "top",
  })
  const errors = await runAllRoutingChecks(circuitJson)
  expect(errors).toEqual([
    expect.objectContaining({
      type: "pcb_trace_error",
      center: { x: 2.5, y: 0 },
      message: expect.stringContaining('"J1.pin2" (accidental contact)'),
    }),
  ])
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      width: 1200,
      height: 700,
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
