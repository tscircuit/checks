import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkSourceTracesHavePcbTraces } from "../../lib/check-source-traces-have-pcb-traces"
import circuitJsonFixture from "../assets/repro-pcb-trace-missing-false-positive.json"

test("reproduces false-positive pcb_trace_missing_error issues", () => {
  const circuitJson = circuitJsonFixture as AnyCircuitElement[]
  const fixtureErrors = circuitJson.filter(
    (element) => element.type === "pcb_trace_missing_error",
  )
  expect(fixtureErrors).toHaveLength(0)

  const errors = checkSourceTracesHavePcbTraces(circuitJson)
  expect(errors).toHaveLength(21)

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
