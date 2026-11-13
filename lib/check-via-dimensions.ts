import { jlcMinTolerances } from "@tscircuit/jlcpcb-manufacturing-specs"
import type {
  AnyCircuitElement,
  PcbVia,
  PcbViaClearanceError,
} from "circuit-json"
import { formatMm } from "format-si-unit"
import {
  DEFAULT_MIN_VIA_ANNULAR_RING,
  EPSILON,
  getBoardDrcValue,
} from "./drc-defaults"
import {
  getAnnularRing,
  getViaRingGeometry,
} from "./util/annular-ring-geometry"
import { getOwningPcbBoardResolver } from "./util/get-owning-pcb-board"
import { getReadableNameForElementId } from "./util/get-readable-names"

const formatLocation = ({ x, y }: { x: number; y: number }) =>
  `(${x.toFixed(2)}mm, ${y.toFixed(2)}mm)`

/** "Unnamed via at (1.00mm, 2.00mm)" or "Via GND_STITCH at (...)" */
const getViaLabel = (circuitJson: AnyCircuitElement[], via: PcbVia) => {
  const name = getReadableNameForElementId(circuitJson, via.pcb_via_id)
  const label = name.startsWith("unnamed ") ? name : `via ${name}`
  return `${label[0].toUpperCase()}${label.slice(1)} at ${formatLocation(via)}`
}

/**
 * Checks each via's drill and pad against its board's min_via_hole_diameter
 * and min_via_pad_diameter, and the copper ring between them against a
 * minimum annular ring. One error is reported per via, naming every rule it
 * breaks.
 */
export function checkViaDimensions(
  circuitJson: AnyCircuitElement[],
  {
    minViaHoleDiameter,
    minViaPadDiameter,
    minViaAnnularRing = DEFAULT_MIN_VIA_ANNULAR_RING,
  }: {
    minViaHoleDiameter?: number
    minViaPadDiameter?: number
    minViaAnnularRing?: number
  } = {},
): PcbViaClearanceError[] {
  const vias = circuitJson.filter(
    (element): element is PcbVia => element.type === "pcb_via",
  )
  if (vias.length === 0) return []

  const getOwningBoard = getOwningPcbBoardResolver(circuitJson)
  const errors: PcbViaClearanceError[] = []

  for (const via of vias) {
    if (
      !Number.isFinite(via.hole_diameter) ||
      !Number.isFinite(via.outer_diameter)
    ) {
      continue
    }
    const board = getOwningBoard(via)
    const requiredHoleDiameter =
      minViaHoleDiameter ??
      getBoardDrcValue(board, "min_via_hole_diameter") ??
      jlcMinTolerances.min_via_hole_diameter!
    const requiredPadDiameter =
      minViaPadDiameter ??
      getBoardDrcValue(board, "min_via_pad_diameter") ??
      jlcMinTolerances.min_via_pad_diameter!

    const { hole, pad } = getViaRingGeometry(via)
    const annularRing = getAnnularRing(hole, pad)

    const violations: string[] = []
    if (via.hole_diameter + EPSILON < requiredHoleDiameter) {
      violations.push(
        `drill ${formatMm(via.hole_diameter)} is below the minimum via drill of ${formatMm(requiredHoleDiameter)}`,
      )
    }
    if (via.outer_diameter + EPSILON < requiredPadDiameter) {
      violations.push(
        `pad ${formatMm(via.outer_diameter)} is below the minimum via pad of ${formatMm(requiredPadDiameter)}`,
      )
    }
    const ringTooSmall = annularRing + EPSILON < minViaAnnularRing
    if (ringTooSmall) {
      violations.push(
        annularRing <= 0
          ? `drill ${formatMm(via.hole_diameter)} is not smaller than its pad ${formatMm(via.outer_diameter)}, leaving no annular ring`
          : `annular ring ${formatMm(annularRing)} is below the minimum of ${formatMm(minViaAnnularRing)}`,
      )
    }
    if (violations.length === 0) continue

    errors.push({
      type: "pcb_via_clearance_error",
      pcb_error_id: `via_dimensions_${via.pcb_via_id}`,
      error_type: "pcb_via_clearance_error",
      message: `${getViaLabel(circuitJson, via)}: ${violations.join("; ")}`,
      pcb_via_ids: [via.pcb_via_id],
      ...(ringTooSmall && {
        minimum_clearance: minViaAnnularRing,
        actual_clearance: Math.max(0, annularRing),
      }),
      pcb_center: { x: via.x, y: via.y },
      ...(via.subcircuit_id && { subcircuit_id: via.subcircuit_id }),
    })
  }

  return errors
}
