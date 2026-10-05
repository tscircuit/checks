import {
  type AnyCircuitElement,
  type SourceComponentMisconfiguredError,
  type SourcePort,
  source_component_misconfigured_error,
  voltage,
} from "circuit-json"
import { getSourcePortConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { getReadableNameForSourcePort } from "./util/get-readable-names"

type SourcePortId = SourcePort["source_port_id"]

export interface SourcePinVoltageCompatibilityOptions {
  /** Explicit relative tolerances (0.05 means ±5%), keyed by consumer pin. */
  requiredVoltageToleranceBySourcePortId?: ReadonlyMap<SourcePortId, number>
}

/** Only compare documented scalar voltages; legacy ranges/prose are not scalars. */
const parseScalarVoltage = (value: unknown): number | undefined => {
  if (value === undefined) return undefined
  if (
    typeof value === "string" &&
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?\s*(?:[pnumkKMGTµμ]?V)?$/i.test(
      value.trim(),
    )
  )
    return undefined
  try {
    const volts = voltage.parse(value)
    return Number.isFinite(volts) ? volts : undefined
  } catch {
    return undefined
  }
}

/** Compare explicit supply and required voltages on connected source pins.
 * Source connectivity includes traces, net IDs and internal pin connections,
 * never an assumed connection through a resistor, regulator or other component.
 * No operating range or hardware tolerance is inferred from a nominal scalar.
 */
export function checkSourcePinVoltageCompatibility(
  circuitJson: AnyCircuitElement[],
  {
    requiredVoltageToleranceBySourcePortId,
  }: SourcePinVoltageCompatibilityOptions = {},
): SourceComponentMisconfiguredError[] {
  const connectivity = getSourcePortConnectivityMapFromCircuitJson(circuitJson)
  const sourcePorts = circuitJson.filter(
    (element): element is SourcePort => element.type === "source_port",
  )
  const suppliesByNet = new Map<
    string,
    { sourcePort: SourcePort; volts: number }[]
  >()
  for (const sourcePort of sourcePorts) {
    const volts = parseScalarVoltage(sourcePort.provides_voltage)
    if (volts === undefined) continue
    const net = connectivity.getNetConnectedToId(sourcePort.source_port_id)
    if (net === undefined) continue
    const supplies = suppliesByNet.get(net) ?? []
    supplies.push({ sourcePort, volts })
    suppliesByNet.set(net, supplies)
  }

  const errors: SourceComponentMisconfiguredError[] = []
  for (const consumerPort of sourcePorts) {
    const requiredVolts = parseScalarVoltage(consumerPort.requires_voltage)
    if (requiredVolts === undefined) continue
    const net = connectivity.getNetConnectedToId(consumerPort.source_port_id)
    if (net === undefined) continue
    for (const supply of suppliesByNet.get(net) ?? []) {
      if (supply.sourcePort.source_port_id === consumerPort.source_port_id)
        continue
      const relativeTolerance =
        requiredVoltageToleranceBySourcePortId?.get(
          consumerPort.source_port_id,
        ) ?? 0
      // Preserve roundoff allowance at inclusive tolerance boundaries.
      if (
        Math.abs(supply.volts - requiredVolts) <=
        Math.abs(requiredVolts) * relativeTolerance +
          1e-9 * Math.max(1, Math.abs(supply.volts), Math.abs(requiredVolts))
      )
        continue
      errors.push(
        source_component_misconfigured_error.parse({
          type: "source_component_misconfigured_error",
          message: `${getReadableNameForSourcePort(circuitJson, consumerPort)} requires ${requiredVolts} V, but is connected to ${getReadableNameForSourcePort(circuitJson, supply.sourcePort)}, which provides ${supply.volts} V.`,
          source_component_ids: [
            ...new Set(
              [
                consumerPort.source_component_id,
                supply.sourcePort.source_component_id,
              ].filter((id): id is string => id !== undefined),
            ),
          ],
          source_port_ids: [
            consumerPort.source_port_id,
            supply.sourcePort.source_port_id,
          ],
          is_fatal: true,
        }),
      )
    }
  }
  return errors
}
