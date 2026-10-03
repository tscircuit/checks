import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"
import { expect, test } from "bun:test"
import {
  type SourcePort,
  source_component_misconfigured_error,
} from "circuit-json"
import { runAllNetlistChecks } from "lib/run-all-checks"
import { Circuit } from "tscircuit"

test("F1C100S AVCC rejects a 1.8 V regulator and accepts the correct 2.8 V supply", async () => {
  // Pin 80 AVCC and regulator pin 5 VOUT mirror the stored datasheet attributes:
  // https://tscircuit.com/datasheets/F1C100S
  // https://tscircuit.com/datasheets/AP2127K-2.8TRG1
  for (const outputVoltage of [1.8, 2.8]) {
    const circuit = new Circuit()
    circuit.pcbDisabled = true
    circuit.add(
      <board routingDisabled>
        <chip
          name="U_F1C"
          manufacturerPartNumber="F1C100S"
          pinLabels={{ pin80: "AVCC" }}
          pinAttributes={{
            AVCC: { requiresVoltage: 2.8, requiresPower: true },
          }}
          connections={{ AVCC: "net.AVCC" }}
        />
        <chip
          name="U_REG"
          pinLabels={{ pin5: "VOUT" }}
          pinAttributes={{
            VOUT: { providesVoltage: outputVoltage, providesPower: true },
          }}
          connections={{ VOUT: "net.AVCC" }}
        />
      </board>,
    )
    await circuit.renderUntilSettled()
    const circuitJson = normalizeFixtureSourcePorts(circuit.getCircuitJson())
    const errors = await runAllNetlistChecks(circuitJson)
    if (outputVoltage === 2.8) {
      expect(errors).toEqual([])
      continue
    }
    expect(errors).toHaveLength(1)
    const error = source_component_misconfigured_error.parse(errors[0])
    const sourcePorts = circuitJson.filter(
      (element): element is SourcePort => element.type === "source_port",
    )
    expect(error.is_fatal).toBe(true)
    expect(error.message).toBe(
      "U_F1C.AVCC requires 2.8 V, but is connected to U_REG.VOUT, which provides 1.8 V.",
    )
    expect(error.source_port_ids).toEqual([
      sourcePorts.find((port) => port.name === "AVCC")!.source_port_id,
      sourcePorts.find((port) => port.name === "VOUT")!.source_port_id,
    ])
    expect(error.source_component_ids).toHaveLength(2)
  }
})
