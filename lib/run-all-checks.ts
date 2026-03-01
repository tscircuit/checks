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
import type { AnyCircuitElement } from "circuit-json"

export async function runAllPlacementChecks(circuitJson: AnyCircuitElement[]) {
  return [
    ...checkViasOffBoard(circuitJson),
    ...checkPcbComponentsOutOfBoard(circuitJson),
    ...checkPcbComponentOverlap(circuitJson),
  ]
}

export async function runAllNetlistChecks(circuitJson: AnyCircuitElement[]) {
  return [
    ...checkEachPcbPortConnectedToPcbTraces(circuitJson),
    ...checkSourceTracesHavePcbTraces(circuitJson),
    ...checkPinMustBeConnected(circuitJson),
  ]
}

export async function runAllRoutingChecks(circuitJson: AnyCircuitElement[]) {
  return [
    ...checkEachPcbTraceNonOverlapping(circuitJson),
    ...checkSameNetViaSpacing(circuitJson),
    ...checkDifferentNetViaSpacing(circuitJson),
    ...checkTracesAreContiguous(circuitJson),
    ...checkPcbTracesOutOfBoard(circuitJson),
  ]
}

export async function runAllChecks(circuitJson: AnyCircuitElement[]) {
  return [
    ...(await runAllPlacementChecks(circuitJson)),
    ...(await runAllNetlistChecks(circuitJson)),
    ...(await runAllRoutingChecks(circuitJson)),
  ]
}
