import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbPlacementError,
} from "circuit-json"
import { formatMm } from "format-si-unit"
import {
  DEFAULT_MIN_PLATED_HOLE_ANNULAR_RING,
  DEFAULT_MIN_VIA_ANNULAR_RING,
  EPSILON,
  getBoardDrcValue,
} from "lib/drc-defaults"
import {
  type AnnularRingMeasurement,
  getPlatedHoleAnnularRing,
  getViaAnnularRing,
} from "lib/util/annular-ring-geometry"
import { getBoardOwnerResolver } from "lib/util/get-board-owner-resolver"
import { getReadableNameForElementId } from "lib/util/get-readable-names"

const formatLocation = ({ x, y }: { x: number; y: number }) =>
  `(${x.toFixed(2)}mm, ${y.toFixed(2)}mm)`

// The shared helper already returns an honest readable label for unnamed
// subjects (`unnamed via`, `unnamed through-hole pad`, `unnamed trace`), so an
// unnamed result is printed as-is instead of being prefixed with its type.
const isUnnamedName = (name: string, id: string) =>
  name === "unnamed element" || name === id || name.startsWith("unnamed ")

const capitalize = (label: string) =>
  `${label[0]!.toUpperCase()}${label.slice(1)}`

const getElementLabel = ({
  circuitJson,
  id,
  typeLabel,
}: {
  circuitJson: AnyCircuitElement[]
  id: string
  typeLabel: string
}) => {
  const name = getReadableNameForElementId(circuitJson, id)
  return capitalize(isUnnamedName(name, id) ? name : `${typeLabel} ${name}`)
}

const getRouteViaLabel = (
  circuitJson: AnyCircuitElement[],
  traceId: string,
) => {
  const name = getReadableNameForElementId(circuitJson, traceId)
  return isUnnamedName(name, traceId)
    ? `via on ${name}`
    : `via on trace ${name}`
}

const getViaViolations = ({
  measurement,
  drillDiameter,
  outerDiameter,
  requiredHoleDiameter,
  requiredPadDiameter,
  minAnnularRing,
}: {
  measurement: AnnularRingMeasurement
  drillDiameter: number
  outerDiameter: number
  requiredHoleDiameter: number
  requiredPadDiameter: number
  minAnnularRing: number
}): string[] => {
  const violations: string[] = []
  if (drillDiameter + EPSILON < requiredHoleDiameter)
    violations.push(
      `drill ${formatMm(drillDiameter)} is below the minimum via drill of ${formatMm(requiredHoleDiameter)}`,
    )
  if (outerDiameter + EPSILON < requiredPadDiameter)
    violations.push(
      `pad ${formatMm(outerDiameter)} is below the minimum via pad of ${formatMm(requiredPadDiameter)}`,
    )
  const ringViolation =
    measurement.status === "breakout"
      ? `drill ${formatMm(drillDiameter)} breaks out of its pad ${formatMm(outerDiameter)}`
      : measurement.annularRing + EPSILON < minAnnularRing
        ? `annular ring ${formatMm(measurement.annularRing)} is below the minimum of ${formatMm(minAnnularRing)}`
        : undefined
  if (ringViolation) violations.push(ringViolation)
  return violations
}

/**
 * Checks every via and plated hole against its board's manufacturing
 * minimums:
 *
 * - vias — both `pcb_via` elements and via route points that carry their own
 *   dimensions — are checked against the owning board's
 *   `min_via_hole_diameter` / `min_via_pad_diameter` (JLCPCB defaults when
 *   unset) plus a minimum annular ring;
 * - plated holes are checked against a minimum annular ring measured from
 *   their real pad and drill outlines — circular, pill and slot drills,
 *   rectangular and rounded pads at their written offsets and rotations, and
 *   polygon pads including non-convex ones. A drill that breaks out of its
 *   pad is reported as a breakout, never as a fabricated ring number.
 *
 * Missing or unsupported geometry (elliptical outlines, unsupported pad
 * shapes, malformed outlines) is skipped rather than approximated: those
 * elements are excluded from the returned errors. Callers that need to know
 * what was not measured must call the exported measurement helpers,
 * `getViaAnnularRing` and `getPlatedHoleAnnularRing`, which report an
 * `unmeasurable` status with a reason.
 */
export function checkViaAndHoleAnnularRing(
  circuitJson: AnyCircuitElement[],
  {
    minViaAnnularRing = DEFAULT_MIN_VIA_ANNULAR_RING,
    minPlatedHoleAnnularRing = DEFAULT_MIN_PLATED_HOLE_ANNULAR_RING,
  }: {
    minViaAnnularRing?: number
    minPlatedHoleAnnularRing?: number
  } = {},
): Array<PcbPlacementError> {
  const boards = circuitJson.filter(
    (element): element is PcbBoard => element.type === "pcb_board",
  )
  const boardsById = new Map(boards.map((board) => [board.pcb_board_id, board]))
  const getBoardOwner = getBoardOwnerResolver(circuitJson)
  // Elements without a resolvable board owner fall back to the first board,
  // matching how the other DRC checks treat single-board circuits.
  const getOwningBoard = (element: AnyCircuitElement): PcbBoard | undefined => {
    const boardId = getBoardOwner(element)
    return (boardId ? boardsById.get(boardId) : undefined) ?? boards[0]
  }
  const viaDrcValues = (board: PcbBoard | undefined) => ({
    requiredHoleDiameter:
      getBoardDrcValue(board, "min_via_hole_diameter") ??
      jlcMinTolerances.min_via_hole_diameter!,
    requiredPadDiameter:
      getBoardDrcValue(board, "min_via_pad_diameter") ??
      jlcMinTolerances.min_via_pad_diameter!,
  })
  // Route vias repeat the position and dimensions of a `pcb_via` element on
  // the same board; index those once at 1e-6mm resolution so the trace loop
  // below stays linear instead of scanning the whole circuit for every via.
  // The board identity is part of the key: boards share a coordinate space,
  // so a via on a looser board must not hide a violation on a stricter one.
  const viaKey = (
    board: PcbBoard | undefined,
    via: {
      x: number
      y: number
      hole_diameter: number
      outer_diameter: number
    },
  ) =>
    [
      board?.pcb_board_id ?? "",
      Math.round(via.x * 1e6),
      Math.round(via.y * 1e6),
      Math.round(via.hole_diameter * 1e6),
      Math.round(via.outer_diameter * 1e6),
    ].join("|")
  const placedViaKeys = new Set<string>()
  for (const via of circuitJson)
    if (via.type === "pcb_via")
      placedViaKeys.add(viaKey(getOwningBoard(via), via))

  const errors: Array<PcbPlacementError> = []

  for (const via of circuitJson) {
    if (via.type !== "pcb_via") continue
    const measurement = getViaAnnularRing(via)
    if (measurement.status === "unmeasurable") continue
    const { requiredHoleDiameter, requiredPadDiameter } = viaDrcValues(
      getOwningBoard(via),
    )
    const violations = getViaViolations({
      measurement,
      drillDiameter: via.hole_diameter,
      outerDiameter: via.outer_diameter,
      requiredHoleDiameter,
      requiredPadDiameter,
      minAnnularRing: minViaAnnularRing,
    })
    if (violations.length === 0) continue
    // A single via under its manufacturing minimums is a placement problem,
    // not a clearance between two vias: `pcb_via_clearance_error` requires two
    // `pcb_via_ids`, and circuit-json has no dedicated single-via type yet.
    // Report it with the same interim type used below for route vias and
    // plated holes so all three subjects share one documented taxonomy.
    errors.push({
      type: "pcb_placement_error",
      pcb_placement_error_id: `via_annular_ring_${via.pcb_via_id}`,
      error_type: "pcb_placement_error",
      message: `${getElementLabel({ circuitJson, id: via.pcb_via_id, typeLabel: "via" })} at ${formatLocation(via)}: ${violations.join("; ")}`,
      ...(via.subcircuit_id && { subcircuit_id: via.subcircuit_id }),
    })
  }

  for (const trace of circuitJson) {
    if (trace.type !== "pcb_trace") continue
    const traceBoard = getOwningBoard(trace)
    const { requiredHoleDiameter, requiredPadDiameter } =
      viaDrcValues(traceBoard)
    for (const [pointIndex, point] of trace.route.entries()) {
      if (
        point.route_type !== "via" ||
        point.hole_diameter === undefined ||
        point.outer_diameter === undefined
      )
        continue
      const holeDiameter = point.hole_diameter
      const outerDiameter = point.outer_diameter
      // See the key-building comment above: only same-board repeats dedupe.
      if (
        placedViaKeys.has(
          viaKey(traceBoard, {
            x: point.x,
            y: point.y,
            hole_diameter: holeDiameter,
            outer_diameter: outerDiameter,
          }),
        )
      )
        continue
      const measurement = getViaAnnularRing({
        x: point.x,
        y: point.y,
        hole_diameter: holeDiameter,
        outer_diameter: outerDiameter,
      })
      if (measurement.status === "unmeasurable") continue
      const violations = getViaViolations({
        measurement,
        drillDiameter: holeDiameter,
        outerDiameter,
        requiredHoleDiameter,
        requiredPadDiameter,
        minAnnularRing: minViaAnnularRing,
      })
      if (violations.length === 0) continue
      errors.push({
        type: "pcb_placement_error",
        pcb_placement_error_id: `via_annular_ring_route_${trace.pcb_trace_id}_${pointIndex}`,
        error_type: "pcb_placement_error",
        message: `${getRouteViaLabel(circuitJson, trace.pcb_trace_id)} at ${formatLocation(point)}: ${violations.join("; ")}`,
        ...(trace.subcircuit_id && { subcircuit_id: trace.subcircuit_id }),
      })
    }
  }

  const componentRotations = new Map(
    circuitJson.flatMap((element) =>
      element.type === "pcb_component"
        ? ([[element.pcb_component_id, element.rotation]] as const)
        : [],
    ),
  )

  for (const hole of circuitJson) {
    if (hole.type !== "pcb_plated_hole") continue
    const measurement = getPlatedHoleAnnularRing(
      hole,
      hole.pcb_component_id
        ? componentRotations.get(hole.pcb_component_id)
        : undefined,
    )
    if (measurement.status === "unmeasurable") continue
    const ringPasses =
      measurement.status === "ready" &&
      measurement.annularRing + EPSILON >= minPlatedHoleAnnularRing
    if (ringPasses) continue

    const label = getElementLabel({
      circuitJson,
      id: hole.pcb_plated_hole_id,
      typeLabel: "through-hole pad",
    })
    const drill = measurement.drillDiameter
      ? ` (drill ${formatMm(measurement.drillDiameter)})`
      : ""
    errors.push({
      type: "pcb_placement_error",
      pcb_placement_error_id: `plated_hole_annular_ring_${hole.pcb_plated_hole_id}`,
      error_type: "pcb_placement_error",
      message:
        measurement.status === "breakout"
          ? `${label} at ${formatLocation(hole)}: drill breaks out of its copper pad${drill} (minimum annular ring: ${formatMm(minPlatedHoleAnnularRing)})`
          : `${label} at ${formatLocation(hole)}: annular ring ${formatMm(measurement.annularRing)} is below the minimum of ${formatMm(minPlatedHoleAnnularRing)}${drill}`,
      ...(hole.subcircuit_id && { subcircuit_id: hole.subcircuit_id }),
    })
  }

  return errors
}
