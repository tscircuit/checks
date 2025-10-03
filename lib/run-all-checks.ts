import { checkEachPcbPortConnectedToPcbTraces } from "./check-each-pcb-port-connected-to-pcb-trace"
import { checkEachPcbTraceNonOverlapping } from "./check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkSameNetViaSpacing } from "./check-same-net-via-spacing"
import { checkViasOffBoard } from "./check-pcb-components-out-of-board/checkViasOffBoard"
import { checkPcbComponentsOutOfBoard } from "./check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import { checkTracesAreContiguous } from "./check-traces-are-contiguous/check-traces-are-contiguous"
import { checkSourceTracesHavePcbTraces } from "./check-source-traces-have-pcb-traces"
import { checkTracesStayInsideBoard } from "./check-traces-stay-inside-board/check-traces-stay-inside-board"
import type { AnyCircuitElement } from "circuit-json"

export async function runAllChecks(circuitJson: AnyCircuitElement[]) {
  return [
    ...checkEachPcbPortConnectedToPcbTraces(circuitJson),
    ...checkEachPcbTraceNonOverlapping(circuitJson),
    ...checkSameNetViaSpacing(circuitJson),
    ...checkViasOffBoard(circuitJson),
    ...checkPcbComponentsOutOfBoard(circuitJson),
    ...checkTracesAreContiguous(circuitJson),
    ...checkSourceTracesHavePcbTraces(circuitJson),
    ...checkTracesStayInsideBoard(circuitJson),
  ]
}
