import type { AnyCircuitElement, PcbPortNotConnectedError } from "circuit-json"
import { createDisconnectedPcbNetError } from "./create-disconnected-pcb-net-error"
import { getPcbNetsToCheck } from "./util/get-pcb-nets-to-check"
import { PcbConnectivityContext } from "./util/pcb-connectivity-context"
import { PcbCopperConnectivity } from "./util/pcb-copper-connectivity"

/** No PCB Net Islands: each logical net's required PCB ports must share one
 * connected copper island. Reports one error per net with disconnected ports.
 * Missing emitted copper and unsupported special routes defer affected nets;
 * an empty result is not a continuity proof for those geometries.
 */
export function checkNoPcbNetIslands(
  circuitJson: AnyCircuitElement[],
): PcbPortNotConnectedError[] {
  const context = new PcbConnectivityContext(circuitJson)
  const { sourceTraceConnectivityMap, pcbNetsToCheck } =
    getPcbNetsToCheck(context)
  if (!pcbNetsToCheck.length) return []
  const pcbCopperConnectivity = new PcbCopperConnectivity(
    { connectivity: sourceTraceConnectivityMap },
    context,
  )
  const errors: PcbPortNotConnectedError[] = []
  for (const { netId, pcbPorts, sourceNets } of pcbNetsToCheck) {
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
