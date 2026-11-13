import type {
  AnyCircuitElement,
  PcbPlacementError,
  PcbPlatedHole,
} from "circuit-json"
import { formatMm } from "format-si-unit"
import { DEFAULT_MIN_PLATED_HOLE_ANNULAR_RING, EPSILON } from "./drc-defaults"
import {
  getAnnularRing,
  getPlatedHoleRingGeometry,
} from "./util/annular-ring-geometry"
import { getReadableNameForElementId } from "./util/get-readable-names"

const formatLocation = ({ x, y }: { x: number; y: number }) =>
  `(${x.toFixed(2)}mm, ${y.toFixed(2)}mm)`

/** "Through-hole pad U1.pin3 at (1.00mm, 2.00mm)" or "Unnamed through-hole pad at (...)" */
const getPlatedHoleLabel = (
  circuitJson: AnyCircuitElement[],
  platedHole: PcbPlatedHole,
) => {
  const name = getReadableNameForElementId(
    circuitJson,
    platedHole.pcb_plated_hole_id,
  )
  const label = name.startsWith("unnamed ") ? name : `through-hole pad ${name}`
  return `${label[0].toUpperCase()}${label.slice(1)} at ${formatLocation(platedHole)}`
}

/**
 * Checks the copper left between each plated hole's drill wall and its pad
 * edge, including offset drills and slots in rect, pill and polygon pads.
 */
export function checkPlatedHoleAnnularRing(
  circuitJson: AnyCircuitElement[],
  {
    minAnnularRing = DEFAULT_MIN_PLATED_HOLE_ANNULAR_RING,
  }: { minAnnularRing?: number } = {},
): PcbPlacementError[] {
  const errors: PcbPlacementError[] = []

  for (const element of circuitJson) {
    if (element.type !== "pcb_plated_hole") continue
    const platedHole = element as PcbPlatedHole
    const geometry = getPlatedHoleRingGeometry(platedHole)
    if (!geometry) continue

    const annularRing = getAnnularRing(geometry.hole, geometry.pad)
    if (annularRing + EPSILON >= minAnnularRing) continue

    const label = getPlatedHoleLabel(circuitJson, platedHole)
    errors.push({
      type: "pcb_placement_error",
      pcb_placement_error_id: `plated_hole_annular_ring_${platedHole.pcb_plated_hole_id}`,
      error_type: "pcb_placement_error",
      message:
        annularRing <= 0
          ? `${label} drill breaks out of its copper pad (annular ring ${formatMm(annularRing)}, minimum: ${formatMm(minAnnularRing)})`
          : `${label} annular ring is too small (annular ring: ${formatMm(annularRing)}, minimum: ${formatMm(minAnnularRing)})`,
      ...(platedHole.subcircuit_id && {
        subcircuit_id: platedHole.subcircuit_id,
      }),
    })
  }

  return errors
}
