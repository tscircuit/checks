import type {
  AnyCircuitElement,
  SourceI2cMisconfiguredError,
} from "circuit-json"
import { getSourcePortConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"

type SourceComponent = Extract<
  AnyCircuitElement,
  { source_component_id: string; name: string }
>

export function checkI2cSdaConnectedToSclMisconfigured(
  circuitJson: AnyCircuitElement[],
): SourceI2cMisconfiguredError[] {
  const errors: SourceI2cMisconfiguredError[] = []

  const sourceComponents = circuitJson.filter(
    (el): el is SourceComponent =>
      "source_component_id" in el &&
      (el.type === "source_component" || el.type.startsWith("source_simple_")),
  )

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

      let shouldAddPort = false
      if (port.is_configured_for_i2c_sda) {
        hasSda = true
        shouldAddPort = true
      }
      if (port.is_configured_for_i2c_scl) {
        hasScl = true
        shouldAddPort = true
      }
      if (shouldAddPort && !conflictingPortIds.includes(portId)) {
        conflictingPortIds.push(portId)
      }
    }

    if (hasSda && hasScl) {
      // Sort conflicting port IDs to ensure deterministic ID generation
      const sortedConflicts = [...conflictingPortIds].sort()
      const conflictIdStr = sortedConflicts.join("_")

      const portDetails = sortedConflicts.map((portId) => {
        const port = portMap.get(portId)
        const component = sourceComponents.find(
          (c) => c.source_component_id === port?.source_component_id,
        )
        const componentName = component?.name ?? "Unknown"
        const portName = port?.name ?? "Unknown"
        const i2cRole = port?.is_configured_for_i2c_sda
          ? "I2C SDA"
          : port?.is_configured_for_i2c_scl
            ? "I2C SCL"
            : "Unknown"
        return `${componentName}.${portName} (${i2cRole})`
      })

      errors.push({
        type: "source_i2c_misconfigured_error",
        source_i2c_misconfigured_error_id: `source_i2c_misconfigured_error_${conflictIdStr}`,
        error_type: "source_i2c_misconfigured_error",
        message: `${portDetails.join(" is connected to ")} on the same net. To fix this, ensure SDA and SCL are routed to separate nets.`,
        source_port_ids: conflictingPortIds,
      })
    }
  }

  return errors
}
