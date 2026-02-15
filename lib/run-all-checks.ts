import { checkEachPcbPortConnectedToPcbTraces } from "./check-each-pcb-port-connected-to-pcb-trace"
import { checkEachPcbTraceNonOverlapping } from "./check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkSameNetViaSpacing } from "./check-same-net-via-spacing"
import { checkDifferentNetViaSpacing } from "./check-different-net-via-spacing"
import { checkViasOffBoard } from "./check-pcb-components-out-of-board/checkViasOffBoard"
import { checkPcbComponentsOutOfBoard } from "./check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import { checkTracesAreContiguous } from "./check-traces-are-contiguous/check-traces-are-contiguous"
import { checkSourceTracesHavePcbTraces } from "./check-source-traces-have-pcb-traces"
import { checkPcbTracesOutOfBoard } from "./check-trace-out-of-board/checkTraceOutOfBoard"
import { checkPcbComponentOverlap } from "./check-pcb-components-overlap/checkPcbComponentOverlap"
import { checkPinMustBeConnected } from "./check-pin-must-be-connected"
import { checkHangingTraces } from "./check-hanging-traces/check-hanging-traces"
import type { AnyCircuitElement } from "circuit-json"

export async function runAllChecks(circuitJson: AnyCircuitElement[]) {
  return [
    ...checkEachPcbPortConnectedToPcbTraces(circuitJson),
    ...checkEachPcbTraceNonOverlapping(circuitJson),
    ...checkSameNetViaSpacing(circuitJson),
    ...checkDifferentNetViaSpacing(circuitJson),
    ...checkViasOffBoard(circuitJson),
    ...checkPcbComponentsOutOfBoard(circuitJson),
    ...checkTracesAreContiguous(circuitJson),
    ...checkSourceTracesHavePcbTraces(circuitJson),
    ...checkPcbTracesOutOfBoard(circuitJson),
    ...checkPcbComponentOverlap(circuitJson),
    ...checkPinMustBeConnected(circuitJson),
    ...checkHangingTraces(circuitJson),
  ]
}
