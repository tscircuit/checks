import type { AnyCircuitElement } from "circuit-json"
import { checkAllPinsInComponentAreUnderspecified } from "./check-all-pins-in-component-are-underspecified"
import { checkConnectorAccessibleOrientation } from "./check-connector-accessible-orientation"
import { checkCopperToBoardEdgeClearance } from "./check-copper-to-board-edge-clearance"
import { checkCourtyardOverlap } from "./check-courtyard-overlap/checkCourtyardOverlap"
import { checkDifferentNetViaSpacing } from "./check-different-net-via-spacing"
import { checkEachPcbPortConnectedToPcbTraces } from "./check-each-pcb-port-connected-to-pcb-trace"
import { checkEachPcbTraceNonOverlapping } from "./check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkNoGroundPinDefined } from "./check-no-ground-pin-defined"
import { checkNoPowerPinDefined } from "./check-no-power-pin-defined"
import { checkPadPadClearance } from "./check-pad-pad-clearance"
import { checkPadTraceClearance } from "./check-pad-trace-clearance"
import { checkPcbComponentOverCutout } from "./check-pcb-component-over-cutout"
import { checkPcbComponentsOutOfBoard } from "./check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import { checkPcbComponentOverlap } from "./check-pcb-components-overlap/checkPcbComponentOverlap"
import { checkPcbComponentsMissingCourtyard } from "./check-pcb-components-missing-courtyard"
import { checkPcbTraceLengths } from "./check-pcb-trace-lengths"
import { checkPinMustBeConnected } from "./check-pin-must-be-connected"
import { checkSameNetViaSpacing } from "./check-same-net-via-spacing"
import { checkSchematicComponentExcessiveVerticalPadding } from "./check-schematic-component-excessive-vertical-padding"
import { checkSourceTracesHavePcbTraces } from "./check-source-traces-have-pcb-traces"
import { checkTestPointAccessibility } from "./check-testpoint-accessibility"
import { checkPcbTracesOutOfBoard } from "./check-trace-out-of-board/checkTraceOutOfBoard"
import { checkTracesAreContiguous } from "./check-traces-are-contiguous/check-traces-are-contiguous"
import { checkViaPadClearance } from "./check-via-pad-clearance"
import { checkViaTraceClearance } from "./check-via-trace-clearance"
import { checkViasInPads } from "./check-vias-in-pads"

export async function runAllPlacementChecks(circuitJson: AnyCircuitElement[]) {
  return [
    ...checkCopperToBoardEdgeClearance(circuitJson),
    ...checkViasInPads(circuitJson),
    ...checkPcbComponentsOutOfBoard(circuitJson),
    ...checkPcbComponentOverCutout(circuitJson),
    ...checkPcbComponentOverlap(circuitJson),
    ...checkPcbComponentsMissingCourtyard(circuitJson),
    ...checkPadPadClearance(circuitJson),
    ...checkCourtyardOverlap(circuitJson),
    ...checkConnectorAccessibleOrientation(circuitJson),
    ...checkTestPointAccessibility(circuitJson),
  ]
}

export async function runAllNetlistChecks(circuitJson: AnyCircuitElement[]) {
  return [...checkPinMustBeConnected(circuitJson)]
}

export async function runAllSchematicChecks(circuitJson: AnyCircuitElement[]) {
  return checkSchematicComponentExcessiveVerticalPadding(circuitJson)
}

export async function runAllPinSpecificationChecks(
  circuitJson: AnyCircuitElement[],
) {
  return [
    ...checkAllPinsInComponentAreUnderspecified(circuitJson),
    ...checkNoPowerPinDefined(circuitJson),
    ...checkNoGroundPinDefined(circuitJson),
  ]
}

export async function runAllRoutingChecks(circuitJson: AnyCircuitElement[]) {
  return [
    ...checkEachPcbPortConnectedToPcbTraces(circuitJson),
    ...checkSourceTracesHavePcbTraces(circuitJson),
    ...checkPcbTraceLengths(circuitJson),
    ...checkEachPcbTraceNonOverlapping(circuitJson),
    ...checkPadTraceClearance(circuitJson),
    ...checkViaTraceClearance(circuitJson),
    ...checkViaPadClearance(circuitJson),
    ...checkSameNetViaSpacing(circuitJson),
    ...checkDifferentNetViaSpacing(circuitJson),
    ...checkTracesAreContiguous(circuitJson),
    ...checkPcbTracesOutOfBoard(circuitJson),
  ]
}

export async function runAllChecks(circuitJson: AnyCircuitElement[]) {
  return [
    ...(await runAllPlacementChecks(circuitJson)),
    ...(await runAllSchematicChecks(circuitJson)),
    ...(await runAllNetlistChecks(circuitJson)),
    ...(await runAllPinSpecificationChecks(circuitJson)),
    ...(await runAllRoutingChecks(circuitJson)),
  ]
}
