import { expect, test } from "bun:test"
import { checkSourceTracesMatchPcbTraceThickness } from "lib/check-source-traces-match-pcb-trace-thickness"
import { runAllRoutingChecks } from "lib/run-all-checks"
import { mixedWidthNetWithNeckdownsFixture } from "../fixtures/mixed-width-net"

test("legal constant-width pad neck-downs on a mixed-width net do not throw or warn", async () => {
  const { circuitJson, sourceTrace, pcbTrace } =
    await mixedWidthNetWithNeckdownsFixture("constant")
  expect(checkSourceTracesMatchPcbTraceThickness(circuitJson)).toEqual([])

  const routingChecks = await runAllRoutingChecks(circuitJson)
  expect(
    routingChecks.filter((check) => check.type === "pcb_trace_warning"),
  ).toEqual([])

  // Without an escape allowance, the 0.2 mm copper beyond the pad must warn.
  const withoutEscapeAllowance = checkSourceTracesMatchPcbTraceThickness(
    circuitJson,
    { maxPadNeckdownLength: 0 },
  )
  expect(withoutEscapeAllowance).toHaveLength(1)
  expect(withoutEscapeAllowance[0]).toMatchObject({
    source_trace_id: sourceTrace.source_trace_id,
    pcb_trace_id: pcbTrace.pcb_trace_id,
  })
  expect(withoutEscapeAllowance[0].message).toContain("actual: 0.2mm")
})

test("legal tapered pad neck-downs on a mixed-width net do not throw or warn", async () => {
  const { circuitJson, sourceTrace, pcbTrace } =
    await mixedWidthNetWithNeckdownsFixture("interpolated")
  expect(checkSourceTracesMatchPcbTraceThickness(circuitJson)).toEqual([])

  const routingChecks = await runAllRoutingChecks(circuitJson)
  expect(
    routingChecks.filter((check) => check.type === "pcb_trace_warning"),
  ).toEqual([])

  // With no escape budget, the taper is already 0.44 mm wide at the pad edge.
  const withoutEscapeAllowance = checkSourceTracesMatchPcbTraceThickness(
    circuitJson,
    { maxPadNeckdownLength: 0 },
  )
  expect(withoutEscapeAllowance).toHaveLength(1)
  expect(withoutEscapeAllowance[0]).toMatchObject({
    source_trace_id: sourceTrace.source_trace_id,
    pcb_trace_id: pcbTrace.pcb_trace_id,
  })
  expect(withoutEscapeAllowance[0].message).toContain("actual: 0.44mm")
})
