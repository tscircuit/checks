import type {
  AnyCircuitElement,
  PcbCopperPourIsolatedWarning,
} from "circuit-json"
import {
  type ConnectivityMap,
  getFullConnectivityMapFromCircuitJson,
} from "circuit-json-to-connectivity-map"
import { getPourPolygon } from "@tscircuit/circuit-json-util"
import { getCopperPourConnectivity } from "./copper-pour-connectivity/get-copper-pour-connectivity"
import { getReadableNameForElementId } from "./util/get-readable-names"

/** Report net-assigned fill with no physical path to a same-net pad or via.
 * Logical net membership alone cannot anchor an island. Unassigned decorative
 * copper is ignored. Existing port/trace checks validate the rest of the net.
 */
export function checkCopperPourIslands(
  circuitJson: AnyCircuitElement[],
  { connMap }: { connMap?: ConnectivityMap } = {},
): PcbCopperPourIsolatedWarning[] {
  if (!circuitJson.some((e) => e.type === "pcb_copper_pour" && e.source_net_id))
    return []
  connMap ??= getFullConnectivityMapFromCircuitJson(circuitJson)
  return getCopperPourConnectivity(circuitJson, connMap)
    .getIsolatedPours()
    .map((pour) => {
      const box = getPourPolygon(pour).box
      const center = {
        x: (box.xmin + box.xmax) / 2,
        y: (box.ymin + box.ymax) / 2,
      }
      const netName = getReadableNameForElementId({
        circuitJson,
        elementId: pour.source_net_id!,
      })
      return {
        type: "pcb_copper_pour_isolated_warning",
        pcb_copper_pour_isolated_warning_id: `pcb_copper_pour_isolated_warning_${pour.pcb_copper_pour_id}`,
        warning_type: "pcb_copper_pour_isolated_warning",
        pcb_copper_pour_id: pour.pcb_copper_pour_id,
        source_net_id: pour.source_net_id,
        layer: pour.layer,
        center,
        message: `Copper pour for ${netName} has an isolated island on ${pour.layer} near (${center.x.toFixed(2)} mm, ${center.y.toFixed(2)} mm) with no physical connection to a same-net pad or via`,
        subcircuit_id: pour.subcircuit_id,
      }
    })
}
