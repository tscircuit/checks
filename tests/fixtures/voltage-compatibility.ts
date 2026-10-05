import type { AnyCircuitElement } from "circuit-json"

export const voltageCompatibilityFixture = ({
  providedVoltage = 1.8,
  requiredVoltage = 2.8,
  requiredVoltageTolerance,
}: {
  providedVoltage?: number | string
  requiredVoltage?: number | string
  requiredVoltageTolerance?: number
} = {}): AnyCircuitElement[] => {
  const elements: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "source_component_supply",
      ftype: "simple_chip",
      name: "U_REG",
    },
    {
      type: "source_component",
      source_component_id: "source_component_consumer",
      ftype: "simple_chip",
      name: "U_F1C",
    },
    {
      type: "source_port",
      source_port_id: "source_port_supply",
      source_component_id: "source_component_supply",
      name: "VOUT",
    },
    {
      type: "source_port",
      source_port_id: "source_port_consumer",
      source_component_id: "source_component_consumer",
      name: "AVCC",
      required_voltage_tolerance: requiredVoltageTolerance,
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_supply",
      connected_source_port_ids: ["source_port_supply"],
      connected_source_net_ids: ["source_net_avcc"],
    },
    {
      type: "source_trace",
      source_trace_id: "source_trace_consumer",
      connected_source_port_ids: ["source_port_consumer"],
      connected_source_net_ids: ["source_net_avcc"],
    },
  ]
  // These tests intentionally exercise unchecked legacy values (including
  // unit strings, prose and non-finite numbers), not normalized schema output.
  Reflect.set(elements[2]!, "provides_voltage", providedVoltage)
  Reflect.set(elements[3]!, "requires_voltage", requiredVoltage)
  return elements
}
