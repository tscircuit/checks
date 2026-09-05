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
import { checkPcbCopperOverKeepout } from "./check-pcb-copper-over-keepout"
import { checkPcbComponentsOutOfBoard } from "./check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import { checkPcbComponentOverlap } from "./check-pcb-components-overlap/checkPcbComponentOverlap"
import { checkPcbComponentsMissingCourtyard } from "./check-pcb-components-missing-courtyard"
import { checkPcbTraceLengths } from "./check-pcb-trace-lengths"
import { checkPcbTraceViaCounts } from "./check-pcb-trace-via-counts"
import { checkPinMustBeConnected } from "./check-pin-must-be-connected"
import { checkSameNetViaSpacing } from "./check-same-net-via-spacing"
import { checkSchematicComponentExcessiveVerticalPadding } from "./check-schematic-component-excessive-vertical-padding"
import { checkSchematicComponentMissingReferenceDesignatorText } from "./check-schematic-component-missing-reference-designator-text"
import { checkSchematicComponentPortsOutsideBody } from "./check-schematic-component-ports-outside-body"
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
    ...checkPcbCopperOverKeepout(circuitJson),
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
  return [
    ...checkSchematicComponentExcessiveVerticalPadding(circuitJson),
    ...checkSchematicComponentMissingReferenceDesignatorText(circuitJson),
    ...checkSchematicComponentPortsOutsideBody(circuitJson),
  ]
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

export const routingChecks = {
  checkEachPcbPortConnectedToPcbTraces,
  checkSourceTracesHavePcbTraces,
  checkPcbTraceLengths,
  checkPcbTraceViaCounts,
  checkEachPcbTraceNonOverlapping,
  checkPadTraceClearance,
  checkViaTraceClearance,
  checkViaPadClearance,
  checkSameNetViaSpacing,
  checkDifferentNetViaSpacing,
  checkTracesAreContiguous,
  checkPcbTracesOutOfBoard,
} as const

export type RoutingCheckName = keyof typeof routingChecks
export type RoutingCheckResult = ReturnType<
  (typeof routingChecks)[RoutingCheckName]
>[number]

export interface RoutingCheckOptions {
  /** Omit to run all routing checks; an empty array runs none. */
  checks?: readonly RoutingCheckName[]
  /** The stage where these diagnostics were observed, not necessarily introduced. */
  autoroutingPhase?: import("circuit-json").AutoroutingPhase
}

/** Geometry checks suitable for partially routed circuits (including fanout). */
export const intermediateRoutingChecks = [
  "checkEachPcbTraceNonOverlapping",
  "checkPadTraceClearance",
  "checkViaTraceClearance",
  "checkViaPadClearance",
  "checkSameNetViaSpacing",
  "checkDifferentNetViaSpacing",
  "checkPcbTracesOutOfBoard",
] as const satisfies readonly RoutingCheckName[]

export async function runAllRoutingChecks(
  circuitJson: AnyCircuitElement[],
  options: RoutingCheckOptions = {},
) {
  const selectedChecks =
    options.checks ?? (Object.keys(routingChecks) as RoutingCheckName[])
  const results = [...new Set(selectedChecks)].flatMap<RoutingCheckResult>(
    (name) => routingChecks[name](circuitJson),
  )
  return options.autoroutingPhase
    ? results.map((error) => ({
        ...error,
        autorouting_phase: { ...options.autoroutingPhase! },
      }))
    : results
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
