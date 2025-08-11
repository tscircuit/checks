import { checkEachPcbPortConnected } from "./check-each-pcb-port-connected"
import { checkEachPcbTraceNonOverlapping } from "./check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkSameNetViaSpacing } from "./check-same-net-via-spacing"
import { checkViasOffBoard } from "./check-pcb-components-out-of-board/checkViasOffBoard"
import { checkPcbComponentsOutOfBoard } from "./check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import { checkTracesAreContiguous } from "./check-traces-are-contiguous/check-traces-are-contiguous"
import { checkSourceTracesHavePcbTraces } from "./check-source-traces-have-pcb-traces"
import type { AnyCircuitElement } from "circuit-json"

export async function runAllChecks(circuitJson: AnyCircuitElement[]) {
  return [
    ...checkEachPcbPortConnected(circuitJson),
    ...checkEachPcbTraceNonOverlapping(circuitJson),
    ...checkSameNetViaSpacing(circuitJson),
    ...checkViasOffBoard(circuitJson),
    ...checkPcbComponentsOutOfBoard(circuitJson),
    ...checkTracesAreContiguous(circuitJson),
    ...checkSourceTracesHavePcbTraces(circuitJson),
  ]
}
