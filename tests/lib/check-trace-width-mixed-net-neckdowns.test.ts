import { expect, test } from "bun:test"
import { checkSourceTracesMatchPcbTraceThickness } from "lib/check-source-traces-match-pcb-trace-thickness"
import { runAllRoutingChecks } from "lib/run-all-checks"
import { mixedWidthNetWithNeckdownsFixture } from "../fixtures/mixed-width-net"

test.each([
  { mode: "constant", expectedWidthAtPadEdge: 0.2 },
  { mode: "interpolated", expectedWidthAtPadEdge: 0.44 },
] as const)(
  "legal $mode pad neck-downs on a mixed-width net do not throw or warn",
  async ({ mode, expectedWidthAtPadEdge }) => {
    const { circuitJson, sourceTrace, pcbTrace } =
      await mixedWidthNetWithNeckdownsFixture(mode)
    expect(checkSourceTracesMatchPcbTraceThickness(circuitJson)).toEqual([])

    const routingChecks = await runAllRoutingChecks(circuitJson)
    expect(
      routingChecks.filter((check) => check.type === "pcb_trace_warning"),
    ).toEqual([])

    // Without an escape budget, narrow copper beyond the pad must still warn.
    // The interpolated trace has widened to 0.44 mm where it exits the pad.
    const withoutEscapeAllowance = checkSourceTracesMatchPcbTraceThickness(
      circuitJson,
      { maxPadNeckdownLength: 0 },
    )
    expect(withoutEscapeAllowance).toHaveLength(1)
    expect(withoutEscapeAllowance[0]).toMatchObject({
      source_trace_id: sourceTrace.source_trace_id,
      pcb_trace_id: pcbTrace.pcb_trace_id,
    })
    expect(withoutEscapeAllowance[0].message).toContain(
      `actual: ${expectedWidthAtPadEdge}mm`,
    )
  },
)
