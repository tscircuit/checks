import type { AnyCircuitElement } from "circuit-json"
import { checkAllPinsInComponentAreUnderspecified } from "./check-all-pins-in-component-are-underspecified"
import { checkDifferentNetViaSpacing } from "./check-different-net-via-spacing"
import { checkEachPcbPortConnectedToPcbTraces } from "./check-each-pcb-port-connected-to-pcb-trace"
import { checkEachPcbTraceNonOverlapping } from "./check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkPcbComponentsOutOfBoard } from "./check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import { checkViasOffBoard } from "./check-pcb-components-out-of-board/checkViasOffBoard"
import { checkPcbComponentOverlap } from "./check-pcb-components-overlap/checkPcbComponentOverlap"
import { checkConnectorAccessibleOrientation } from "./check-connector-accessible-orientation"
import { checkPinMustBeConnected } from "./check-pin-must-be-connected"
import { checkSameNetViaSpacing } from "./check-same-net-via-spacing"
import { checkViaToPadSpacing } from "./check-via-to-pad-spacing"
import { checkSourceTracesHavePcbTraces } from "./check-source-traces-have-pcb-traces"
import { checkPcbTracesOutOfBoard } from "./check-trace-out-of-board/checkTraceOutOfBoard"
import { checkTracesAreContiguous } from "./check-traces-are-contiguous/check-traces-are-contiguous"

export async function runAllPlacementChecks(circuitJson: AnyCircuitElement[]) {
  return [
    ...checkViasOffBoard(circuitJson),
    ...checkPcbComponentsOutOfBoard(circuitJson),
    ...checkPcbComponentOverlap(circuitJson),
    ...checkConnectorAccessibleOrientation(circuitJson),
  ]
}

export async function runAllNetlistChecks(circuitJson: AnyCircuitElement[]) {
  return [
    ...checkPinMustBeConnected(circuitJson),
    ...checkAllPinsInComponentAreUnderspecified(circuitJson),
  ]
}

export async function runAllRoutingChecks(circuitJson: AnyCircuitElement[]) {
  return [
    ...checkEachPcbPortConnectedToPcbTraces(circuitJson),
    ...checkSourceTracesHavePcbTraces(circuitJson),
    ...checkEachPcbTraceNonOverlapping(circuitJson),
    ...checkSameNetViaSpacing(circuitJson),
    ...checkDifferentNetViaSpacing(circuitJson),
    ...checkViaToPadSpacing(circuitJson),
    // ...checkTracesAreContiguous(circuitJson),
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
