import type { AnyCircuitElement, PcbPortNotConnectedError } from "circuit-json"
import { createDisconnectedPcbNetError } from "./create-disconnected-pcb-net-error"
import { getPcbNetRequirements } from "./util/get-pcb-net-requirements"
import { PcbConnectivityContext } from "./util/pcb-connectivity-context"
import { PcbCopperConnectivity } from "./util/pcb-copper-connectivity"

/** Check complete PCB nets independently of individual trace ownership/endpoints.
 * Missing emitted copper and unsupported special routes defer affected nets;
 * an empty result is not a continuity proof for those geometries.
 */
export function checkPcbNetsAreConnected(
  circuitJson: AnyCircuitElement[],
): PcbPortNotConnectedError[] {
  const context = new PcbConnectivityContext(circuitJson)
  const { sourceConnectivity, netRequirements } = getPcbNetRequirements(context)
  if (!netRequirements.length) return []
  const pcbCopperConnectivity = new PcbCopperConnectivity(
    { connectivity: sourceConnectivity },
    context,
  )
  const errors: PcbPortNotConnectedError[] = []
  for (const { netId, pcbPorts, sourceNets } of netRequirements) {
    const pcbPortIds = pcbPorts.map((pcbPort) => pcbPort.pcb_port_id)
    if (!pcbCopperConnectivity.canVerifyNet({ netId, pcbPortIds })) continue
    if (pcbCopperConnectivity.arePortsConnected(pcbPortIds)) continue
    errors.push(
      createDisconnectedPcbNetError(
        {
          pcbPorts,
          pcbPortGroups: pcbCopperConnectivity.getPortGroups(pcbPortIds),
          sourceNets,
        },
        circuitJson,
      ),
    )
  }
  return errors
}
