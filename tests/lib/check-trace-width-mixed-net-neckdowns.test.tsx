import { expect, test } from "bun:test"
import { checkSourceTracesMatchPcbTraceThickness } from "lib/check-source-traces-match-pcb-trace-thickness"
import { runAllRoutingChecks } from "lib/run-all-checks"
import { mixedWidthNetWithNeckdownsFixture } from "../fixtures/mixed-width-net"

test.each(["constant", "interpolated"] as const)(
  "legal %s pad neck-downs on a mixed-width net do not throw or warn",
  async (mode) => {
    const { circuitJson, sourceTrace, pcbTrace } =
      await mixedWidthNetWithNeckdownsFixture(mode)
    expect(checkSourceTracesMatchPcbTraceThickness(circuitJson)).toEqual([])

    // The build's aggregate routing check must also accept the legal neck-downs.
    const routingChecks = await runAllRoutingChecks(circuitJson)
    expect(
      routingChecks.filter((check) => check.type === "pcb_trace_warning"),
    ).toEqual([])

    // This is real undersized copper, exempted only by the pad escape budget.
    const withoutEscapeAllowance = checkSourceTracesMatchPcbTraceThickness(
      circuitJson,
      { maxPadNeckdownLength: 0 },
    )
    expect(withoutEscapeAllowance).toHaveLength(1)
    expect(withoutEscapeAllowance[0]).toMatchObject({
      source_trace_id: sourceTrace.source_trace_id,
      pcb_trace_id: pcbTrace.pcb_trace_id,
    })
    // With no escape budget, a taper is already 0.44 mm wide at the pad edge.
    expect(withoutEscapeAllowance[0].message).toContain(
      `actual: ${mode === "interpolated" ? 0.44 : 0.2}mm`,
    )
  },
)
