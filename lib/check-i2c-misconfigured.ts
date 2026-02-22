import type {
  AnyCircuitElement,
  SourceI2cMisconfiguredError,
} from "circuit-json"
import { getSourcePortConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"

export function checkI2cMisconfigured(
  circuitJson: AnyCircuitElement[],
): SourceI2cMisconfiguredError[] {
  const errors: SourceI2cMisconfiguredError[] = []

  // Get all source ports to easily look up their attributes
  const sourcePorts = circuitJson.filter(
    (el): el is Extract<AnyCircuitElement, { type: "source_port" }> =>
      el.type === "source_port",
  )
  const portMap = new Map(sourcePorts.map((p) => [p.source_port_id, p]))

  const connMap = getSourcePortConnectivityMapFromCircuitJson(circuitJson)

  for (const [netId, connectedPortIds] of Object.entries(connMap.netMap)) {
    let hasSda = false
    let hasScl = false

    const conflictingPortIds: string[] = []

    for (const portId of connectedPortIds) {
      const port = portMap.get(portId)
      if (!port) continue

      if (port.is_configured_for_i2c_sda) {
        hasSda = true
        conflictingPortIds.push(portId)
      }
      if (port.is_configured_for_i2c_scl) {
        hasScl = true
        conflictingPortIds.push(portId)
      }
    }

    if (hasSda && hasScl) {
      errors.push({
        type: "source_i2c_misconfigured_error",
        source_i2c_misconfigured_error_id: `source_i2c_misconfigured_error_${netId}`,
        error_type: "source_i2c_misconfigured_error",
        message: "I2C SDA and SCL pins are connected together",
        source_port_ids: conflictingPortIds,
      })
    }
  }

  return errors
}
