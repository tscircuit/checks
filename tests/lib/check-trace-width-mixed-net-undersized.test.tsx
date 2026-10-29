import { expect, test } from "bun:test"
import { checkSourceTracesMatchPcbTraceThickness } from "lib/check-source-traces-match-pcb-trace-thickness"
import {
  mixedWidthNetFixture,
  renderMixedWidthNetWarnings,
} from "../fixtures/mixed-width-net"

test("an undersized trace reports its own copper rather than a thinner net branch", async () => {
  const { circuitJson, sourceTrace, pcbTrace } = await mixedWidthNetFixture(0.4)
  const warnings = checkSourceTracesMatchPcbTraceThickness(circuitJson)
  expect(renderMixedWidthNetWarnings(circuitJson, warnings)).toMatchSvgSnapshot(
    import.meta.path,
  )
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    source_trace_id: sourceTrace.source_trace_id,
    pcb_trace_id: pcbTrace.pcb_trace_id,
  })
  expect(warnings[0].message).toContain("requested: 0.8mm, actual: 0.4mm")
})
