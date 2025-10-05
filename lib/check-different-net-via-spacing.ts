import type {
  AnyCircuitElement,
  PcbVia,
  PcbViaClearanceError,
} from "circuit-json"
import { getReadableNameForElement } from "@tscircuit/circuit-json-util"
import {
  getFullConnectivityMapFromCircuitJson,
  type ConnectivityMap,
} from "circuit-json-to-connectivity-map"
import { DEFAULT_DIFFERENT_NET_VIA_MARGIN, EPSILON } from "lib/drc-defaults"

function distance(a: PcbVia, b: PcbVia): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function checkDifferentNetViaSpacing(
  circuitJson: AnyCircuitElement[],
  {
    connMap,
    minSpacing = DEFAULT_DIFFERENT_NET_VIA_MARGIN,
  }: { connMap?: ConnectivityMap; minSpacing?: number } = {},
): PcbViaClearanceError[] {
  const vias = circuitJson.filter((el) => el.type === "pcb_via") as PcbVia[]
  if (vias.length < 2) return []
  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
  const errors: PcbViaClearanceError[] = []
  const reported = new Set<string>()

  for (let i = 0; i < vias.length; i++) {
    for (let j = i + 1; j < vias.length; j++) {
      const viaA = vias[i]
      const viaB = vias[j]
      if (connMap.areIdsConnected(viaA.pcb_via_id, viaB.pcb_via_id)) continue
      const gap =
        distance(viaA, viaB) - viaA.outer_diameter / 2 - viaB.outer_diameter / 2
      if (gap + EPSILON >= minSpacing) continue
      const pairId = [viaA.pcb_via_id, viaB.pcb_via_id].sort().join("_")
      if (reported.has(pairId)) continue
      reported.add(pairId)
      errors.push({
        type: "pcb_via_clearance_error",
        pcb_error_id: `different_net_vias_close_${pairId}`,
        message: `Vias ${getReadableNameForElement(
          circuitJson,
          viaA.pcb_via_id,
        )} and ${getReadableNameForElement(
          circuitJson,
          viaB.pcb_via_id,
        )} from different nets are too close together (gap: ${gap.toFixed(
          3,
        )}mm)`,
        error_type: "pcb_via_clearance_error",
        pcb_via_ids: [viaA.pcb_via_id, viaB.pcb_via_id],
        minimum_clearance: minSpacing,
        actual_clearance: gap,
        pcb_center: {
          x: (viaA.x + viaB.x) / 2,
          y: (viaA.y + viaB.y) / 2,
        },
      })
    }
  }

  return errors
}
