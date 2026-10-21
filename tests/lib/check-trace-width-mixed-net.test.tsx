import { expect, test } from "bun:test"
import { checkSourceTracesMatchPcbTraceThickness } from "lib/check-source-traces-match-pcb-trace-thickness"
import {
  mixedWidthNetFixture,
  renderMixedWidthNetWarnings,
} from "../fixtures/mixed-width-net"

test("correct traces with different requested widths may share a net", async () => {
  const { circuitJson } = await mixedWidthNetFixture()
  const warnings = checkSourceTracesMatchPcbTraceThickness(circuitJson)
  expect(renderMixedWidthNetWarnings(circuitJson, warnings)).toMatchSvgSnapshot(
    import.meta.path,
  )
  expect(warnings).toEqual([])
})
