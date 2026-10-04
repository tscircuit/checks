import * as circuit_json from 'circuit-json';
import { AnyCircuitElement, PcbTraceError, PcbPlacementError, PcbPortNotConnectedError, PcbKeepoutOverlapWarning, PcbComponentOutsideBoardError, PcbViaClearanceError, PcbTraceWarning, PcbTraceMissingError, PcbFootprintOverlapError, PcbPadPadClearanceError, PcbCourtyardOverlapError, PcbComponentMissingCourtyardWarning, PcbTraceTooLongError, PcbPadTraceClearanceError, PcbViaTraceClearanceError, SourceComponentMisconfiguredError, SourceComponentPinsUnderspecifiedWarning, SourceNoPowerPinDefinedWarning, SourceNoGroundPinDefinedWarning, SchematicComponentStylingWarning, PcbConnectorNotInAccessibleOrientationWarning, SourceConfusingNetNameWarning, PcbBusLengthSkewError } from 'circuit-json';
import { ConnectivityMap, PcbConnectivityMap } from 'circuit-json-to-connectivity-map';

/** Reports exposed trace endpoints, independently of required-port connectivity. */
declare function checkDanglingTraces(circuitJson: AnyCircuitElement[], options?: {
    connMap?: ConnectivityMap;
}): PcbTraceError[];

/** Detect copper contact that bypasses part of a length-matched route. */
declare function checkPcbTraceSelfShorts(circuitJson: AnyCircuitElement[]): PcbTraceError[];

/** Detect accidental copper contact, rather than enforcing a clearance margin. */
declare function checkCopperPourShorts(circuitJson: AnyCircuitElement[], { connMap }?: {
    connMap?: ConnectivityMap;
}): PcbPlacementError[];

declare function checkEachPcbPortConnectedToPcbTraces(circuitJson: AnyCircuitElement[], { connMap, pcbConnectivityMap, }?: {
    connMap?: ConnectivityMap;
    pcbConnectivityMap?: PcbConnectivityMap;
}): PcbPortNotConnectedError[];

declare function checkEachPcbTraceNonOverlapping(circuitJson: AnyCircuitElement[], { connMap, minClearance, }?: {
    connMap?: ConnectivityMap;
    minClearance?: number;
}): (PcbTraceError | PcbKeepoutOverlapWarning)[];

declare class NetManager {
    private networks;
    setConnected(nodes: string[]): void;
    isConnected(nodes: string[]): boolean;
}

declare function checkViasOffBoard(circuitJson: AnyCircuitElement[]): PcbPlacementError[];

/**
 * Checks the finished copper geometry of every via, SMT pad, plated hole, and
 * copper pour against the real board outline and its configured edge-clearance
 * rule.
 *
 * Component and footprint rotations are normally composed into Circuit JSON's
 * absolute coordinates and `ccw_rotation` fields. Polygon-pad plated holes are
 * the exception: their outline stays local, so it is translated and rotated by
 * the owning component here.
 */
declare function checkCopperToBoardEdgeClearance(circuitJson: AnyCircuitElement[]): PcbPlacementError[];

/**
 * Main function — polygon-first: construct polygons, test containment / intersection,
 * compute overlap distance using boolean intersection area or geometric distance.
 */
declare function checkPcbComponentsOutOfBoard(circuitJson: AnyCircuitElement[]): PcbComponentOutsideBoardError[];

/**
 * Cutouts remove PCB material on every layer, so a component body or SMT pad
 * overlapping a cutout is invalid on both top and bottom.
 */
declare function checkPcbComponentOverCutout(circuitJson: AnyCircuitElement[]): PcbPlacementError[];

/** Check component placement envelopes even when their copper clears a keepout. */
declare function checkPcbCourtyardOverKeepout(circuitJson: AnyCircuitElement[]): (PcbPlacementError | PcbKeepoutOverlapWarning)[];

declare function checkPcbCopperOverKeepout(circuitJson: AnyCircuitElement[]): (PcbPlacementError | PcbKeepoutOverlapWarning)[];

declare function checkSameNetViaSpacing(circuitJson: AnyCircuitElement[], { connMap, minClearance, }?: {
    connMap?: ConnectivityMap;
    minClearance?: number;
}): PcbViaClearanceError[];

declare function checkDifferentNetViaSpacing(circuitJson: AnyCircuitElement[], { connMap, minClearance, }?: {
    connMap?: ConnectivityMap;
    minClearance?: number;
}): PcbViaClearanceError[];

declare function checkSourceTracesMatchPcbTraceThickness(circuitJson: AnyCircuitElement[], { maxPadNeckdownLength, }?: {
    /** Maximum routed escape length beyond an endpoint pad, in mm. Defaults
     * to the requested trace width. This is a nominal-width warning heuristic,
     * not an electrical current-capacity or thermal exemption. */
    maxPadNeckdownLength?: number;
}): PcbTraceWarning[];

/**
 * Check that each source_trace which connects source ports has at least one
 * pcb_trace associated with it, or its ports physically joined through a
 * same-net copper pour. Otherwise return an error for that source_trace.
 */
declare function checkSourceTracesHavePcbTraces(circuitJson: AnyCircuitElement[], { connMap }?: {
    connMap?: ConnectivityMap;
}): PcbTraceMissingError[];

interface PcbConnectivityGeometryCacheStats {
    hits: number;
    misses: number;
    entries: number;
}
/** Opt-in, bounded geometry reuse between physical connectivity evaluations. */
declare class PcbConnectivityGeometryCache {
    constructor();
    clear(): void;
    getStats(): PcbConnectivityGeometryCacheStats;
}

declare function checkTracesAreContiguous(circuitJson: AnyCircuitElement[], { connMap, pcbConnectivityMap, connectivityGeometryCache, }?: {
    connMap?: ConnectivityMap;
    pcbConnectivityMap?: PcbConnectivityMap;
    connectivityGeometryCache?: PcbConnectivityGeometryCache;
}): PcbTraceError[];

/**
 * Configuration for trace board boundary checking
 */
interface TraceBoardCheckConfig {
    /** Minimum distance from trace center to board edge (in mm) */
    margin?: number;
}
/**
 * Check if any trace segment is too close to or outside the board outline
 * Uses segment-to-polygon distance with configurable margin
 */
declare function checkPcbTracesOutOfBoard(circuitJson: AnyCircuitElement[], config?: TraceBoardCheckConfig): PcbTraceError[];

/** Additional diagnostic context supplied by checks; the base error remains
 * compatible with existing Circuit JSON renderers. */
interface PcbComponentOverlapError extends PcbFootprintOverlapError {
    pcb_component_ids?: string[];
    related_errors?: PlacementOverlapError[];
}
type PlacementOverlapError = PcbComponentOverlapError | PcbPadPadClearanceError | PcbCourtyardOverlapError;
/**
 * Consolidate placement conflicts for the same exact pair of components, only
 * when a footprint overlap was detected. Keep raw details and all affected
 * pad/hole IDs on one renderer-compatible error. Unrelated checks, standalone
 * elements, same-component clearance errors and clearance-only pairs survive.
 * Does not mutate inputs; safe to apply again when combining check runners.
 */
declare function consolidatePcbOverlapErrors<T extends AnyCircuitElement>(circuitJson: AnyCircuitElement[], errors: T[]): (T | PcbComponentOverlapError)[];

/**
 * Check for overlapping PCB components
 * Returns errors for components that overlap inappropriately
 */
declare function checkPcbComponentOverlap(circuitJson: AnyCircuitElement[]): PcbComponentOverlapError[];

/** Returns warnings for PCB components without courtyards, excluding manually placed vias. */
declare function checkPcbComponentsMissingCourtyard(circuitJson: AnyCircuitElement[]): PcbComponentMissingCourtyardWarning[];

declare const checkPcbTraceLengths: (circuitJson: AnyCircuitElement[]) => PcbTraceTooLongError[];

/** Return a routing error when a source trace exceeds its maximum via count. */
declare const checkPcbTraceViaCounts: (circuitJson: AnyCircuitElement[]) => PcbTraceError[];

declare function checkPadPadClearance(circuitJson: AnyCircuitElement[], { connMap, minClearance, }?: {
    connMap?: ConnectivityMap;
    minClearance?: number;
}): PcbPadPadClearanceError[];

declare function checkPadTraceClearance(circuitJson: AnyCircuitElement[], { connMap, minClearance, }?: {
    connMap?: ConnectivityMap;
    minClearance?: number;
}): PcbPadTraceClearanceError[];

declare function checkViaTraceClearance(circuitJson: AnyCircuitElement[], { connMap, minClearance, }?: {
    connMap?: ConnectivityMap;
    minClearance?: number;
}): PcbViaTraceClearanceError[];

declare function checkViaPadClearance(circuitJson: AnyCircuitElement[], { connMap, minClearance, }?: {
    connMap?: ConnectivityMap;
    minClearance?: number;
}): PcbPadPadClearanceError[];

declare function checkViasInPads(circuitJson: AnyCircuitElement[]): PcbPlacementError[];

/**
 * Removes generic pcb_trace_error records when a more specific pad-trace or
 * via-trace clearance error describes the same physical pair.
 *
 * The specific record is retained because it includes the measured and
 * required clearance. Trace-trace and all other generic errors are untouched.
 *
 * @deprecated Aggregate runners now classify trace-obstacle pairs as either
 * overlap or clearance before combining results, so they no longer need this
 * post-processing step. Kept for callers combining results from older checks.
 */
declare const dedupePcbDrcErrors: <T extends AnyCircuitElement>(errors: T[]) => T[];

type SourcePinMustBeConnectedError = {
    type: "source_pin_must_be_connected_error";
    source_pin_must_be_connected_error_id: string;
    error_type: "source_pin_must_be_connected_error";
    message: string;
    source_component_id: string;
    source_port_id: string;
    subcircuit_id?: string;
};
/**
 * Check that each source port with must_be_connected attribute is actually
 * connected to a trace. Returns errors for any pins that are marked as
 * must_be_connected but are floating (not connected to any trace).
 */
declare function checkPinMustBeConnected(circuitJson: AnyCircuitElement[]): SourcePinMustBeConnectedError[];

declare function checkTwoTerminalSwitchContactsOnDifferentNets(circuitJson: AnyCircuitElement[]): SourceComponentMisconfiguredError[];

/**
 * Check that each component with ports has at least one pin attribute
 * specified across its ports. Returns a warning when all pins are
 * underspecified (no SourcePinAttributes fields set on any port).
 */
declare function checkAllPinsInComponentAreUnderspecified(circuitJson: AnyCircuitElement[]): SourceComponentPinsUnderspecifiedWarning[];

/**
 * Check that each chip has at least one pin marked as requires_power=true.
 * Returns warnings for chips where no pin declares requires_power.
 */
declare function checkNoPowerPinDefined(circuitJson: AnyCircuitElement[]): SourceNoPowerPinDefinedWarning[];

/**
 * Check that each chip has at least one pin marked as requires_ground=true.
 * Returns warnings for chips where no pin declares requires_ground.
 */
declare function checkNoGroundPinDefined(circuitJson: AnyCircuitElement[]): SourceNoGroundPinDefinedWarning[];

/**
 * Warns when the left/right pins of a box-style schematic component leave
 * excessive empty space above or below their vertical span. This commonly
 * happens when an unnecessarily large schematic height is set on a component.
 */
declare function checkSchematicComponentExcessiveVerticalPadding(circuitJson: AnyCircuitElement[]): SchematicComponentStylingWarning[];

/**
 * Warns when a schematic component does not have attached text displaying its
 * reference designator (or the component's display-name override).
 */
declare function checkSchematicComponentMissingReferenceDesignatorText(circuitJson: AnyCircuitElement[]): SchematicComponentStylingWarning[];

/**
 * Warns when a box-style component's pins are positioned beyond the body edge
 * they enter. Left/right pins are checked against the body's vertical span,
 * while top/bottom pins are checked against its horizontal span.
 */
declare function checkSchematicComponentPortsOutsideBody(circuitJson: AnyCircuitElement[]): SchematicComponentStylingWarning[];

declare function checkSchematicPlacement(circuitJson: AnyCircuitElement[]): SchematicComponentStylingWarning[];

declare function runAllPlacementChecks(circuitJson: AnyCircuitElement[], { consolidateOverlaps }?: {
    consolidateOverlaps?: boolean | undefined;
}): Promise<(circuit_json.PcbPlacementError | circuit_json.PcbKeepoutOverlapWarning | circuit_json.PcbComponentOutsideBoardError | PcbComponentOverlapError | circuit_json.PcbPadPadClearanceError | circuit_json.PcbCourtyardOverlapError | circuit_json.PcbComponentMissingCourtyardWarning | circuit_json.PcbConnectorNotInAccessibleOrientationWarning)[]>;
declare function runAllNetlistChecks(circuitJson: AnyCircuitElement[]): Promise<({
    type: "source_pin_must_be_connected_error";
    source_pin_must_be_connected_error_id: string;
    error_type: "source_pin_must_be_connected_error";
    message: string;
    source_component_id: string;
    source_port_id: string;
    subcircuit_id?: string;
} | circuit_json.SourceComponentMisconfiguredError | circuit_json.SourceConfusingNetNameWarning)[]>;
declare function runAllSchematicChecks(circuitJson: AnyCircuitElement[]): Promise<circuit_json.SchematicComponentStylingWarning[]>;
declare function runAllPinSpecificationChecks(circuitJson: AnyCircuitElement[]): Promise<(circuit_json.SourceComponentPinsUnderspecifiedWarning | circuit_json.SourceNoPowerPinDefinedWarning | circuit_json.SourceNoGroundPinDefinedWarning)[]>;
declare function runAllRoutingChecks(circuitJson: AnyCircuitElement[]): Promise<(circuit_json.PcbTraceError | circuit_json.PcbPlacementError | circuit_json.PcbPortNotConnectedError | circuit_json.PcbKeepoutOverlapWarning | circuit_json.PcbViaClearanceError | circuit_json.PcbTraceWarning | circuit_json.PcbTraceMissingError | circuit_json.PcbPadPadClearanceError | circuit_json.PcbTraceTooLongError | circuit_json.PcbPadTraceClearanceError | circuit_json.PcbViaTraceClearanceError | circuit_json.PcbBusLengthSkewError)[]>;
declare function runAllChecks(circuitJson: AnyCircuitElement[]): Promise<(circuit_json.PcbTraceError | circuit_json.PcbPlacementError | circuit_json.PcbPortNotConnectedError | circuit_json.PcbKeepoutOverlapWarning | circuit_json.PcbComponentOutsideBoardError | circuit_json.PcbViaClearanceError | circuit_json.PcbTraceWarning | circuit_json.PcbTraceMissingError | PcbComponentOverlapError | circuit_json.PcbPadPadClearanceError | circuit_json.PcbCourtyardOverlapError | circuit_json.PcbComponentMissingCourtyardWarning | circuit_json.PcbTraceTooLongError | circuit_json.PcbPadTraceClearanceError | circuit_json.PcbViaTraceClearanceError | {
    type: "source_pin_must_be_connected_error";
    source_pin_must_be_connected_error_id: string;
    error_type: "source_pin_must_be_connected_error";
    message: string;
    source_component_id: string;
    source_port_id: string;
    subcircuit_id?: string;
} | circuit_json.SourceComponentMisconfiguredError | circuit_json.SourceComponentPinsUnderspecifiedWarning | circuit_json.SourceNoPowerPinDefinedWarning | circuit_json.SourceNoGroundPinDefinedWarning | circuit_json.SchematicComponentStylingWarning | circuit_json.PcbBusLengthSkewError | circuit_json.SourceConfusingNetNameWarning | circuit_json.PcbConnectorNotInAccessibleOrientationWarning)[]>;

declare function checkConnectorAccessibleOrientation(circuitJson: AnyCircuitElement[]): PcbConnectorNotInAccessibleOrientationWarning[];

/**
 * Test points are intended to be contacted from their PCB side. A test point
 * whose access center is covered by another component's courtyard cannot be
 * reliably reached by a probe after assembly.
 */
declare function checkTestPointAccessibility(circuitJson: AnyCircuitElement[]): PcbPlacementError[];

/** Warn once per name when its source nets belong to multiple electrical islands. */
declare function checkSameNameNetsAreConnected(circuitJson: AnyCircuitElement[]): SourceConfusingNetNameWarning[];

/** Compare total routed lengths of resolved bus members. Unrouted members are
 * left to connectivity checks, never treated as zero-length routes.
 */
declare const checkPcbBusLengthSkew: (circuitJson: AnyCircuitElement[]) => PcbBusLengthSkewError[];

/** Checks trace copper against physical non-plated holes on every copper layer. */
declare function checkHoleTraceClearance(circuitJson: AnyCircuitElement[], { minClearance }?: {
    minClearance?: number;
}): PcbTraceError[];

export { NetManager, type PcbComponentOverlapError, PcbConnectivityGeometryCache, type PcbConnectivityGeometryCacheStats, checkAllPinsInComponentAreUnderspecified, checkConnectorAccessibleOrientation, checkCopperPourShorts, checkCopperToBoardEdgeClearance, checkDanglingTraces, checkDifferentNetViaSpacing, checkEachPcbPortConnectedToPcbTraces, checkEachPcbTraceNonOverlapping, checkHoleTraceClearance, checkNoGroundPinDefined, checkNoPowerPinDefined, checkPadPadClearance, checkPadTraceClearance, checkPcbBusLengthSkew, checkPcbComponentOverCutout, checkPcbComponentOverlap, checkPcbComponentsMissingCourtyard, checkPcbComponentsOutOfBoard, checkPcbCopperOverKeepout, checkPcbCourtyardOverKeepout, checkPcbTraceLengths, checkPcbTraceSelfShorts, checkPcbTraceViaCounts, checkPcbTracesOutOfBoard, checkPinMustBeConnected, checkSameNameNetsAreConnected, checkSameNetViaSpacing, checkSchematicComponentExcessiveVerticalPadding, checkSchematicComponentMissingReferenceDesignatorText, checkSchematicComponentPortsOutsideBody, checkSchematicPlacement, checkSourceTracesHavePcbTraces, checkSourceTracesMatchPcbTraceThickness, checkTestPointAccessibility, checkTracesAreContiguous, checkTwoTerminalSwitchContactsOnDifferentNets, checkViaPadClearance, checkViaTraceClearance, checkViasInPads, checkViasOffBoard, consolidatePcbOverlapErrors, dedupePcbDrcErrors, runAllChecks, runAllNetlistChecks, runAllPinSpecificationChecks, runAllPlacementChecks, runAllRoutingChecks, runAllSchematicChecks };
