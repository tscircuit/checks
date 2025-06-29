import { runTscircuitCode } from "tscircuit"
import { checkEachPcbPortConnected } from "./check-each-pcb-port-connected"
import { checkEachPcbTraceNonOverlapping } from "./check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkSameNetViaSpacing } from "./check-same-net-via-spacing"
import { checkViasOffBoard } from "./check-pcb-components-out-of-board/checkViasOffBoard"
import { checkPcbComponentsOutOfBoard } from "./check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import { checkTracesAreContiguous } from "./check-traces-are-contiguous/check-traces-are-contiguous"

export async function runAllChecks(code: string) {
  const circuitJson = await runTscircuitCode(code)
  return [
    ...checkEachPcbPortConnected(circuitJson as any),
    ...checkEachPcbTraceNonOverlapping(circuitJson as any),
    ...checkSameNetViaSpacing(circuitJson as any),
    ...checkViasOffBoard(circuitJson as any),
    ...checkPcbComponentsOutOfBoard(circuitJson as any),
    ...checkTracesAreContiguous(circuitJson as any),
  ]
}
