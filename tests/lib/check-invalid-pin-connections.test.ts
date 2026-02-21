import { expect, test } from "bun:test"
import { checkInvalidPinConnections } from "../../lib/check-invalid-pin-connections"
import type { AnyCircuitElement } from "circuit-json"

test("checkInvalidPinConnections detects SDA connected to SCL", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_port",
      source_port_id: "port_sda",
      name: "SDA",
      is_configured_for_i2c_sda: true,
    },
    {
      type: "source_port",
      source_port_id: "port_scl",
      name: "SCL",
      is_configured_for_i2c_scl: true,
    },
    {
      type: "source_trace",
      source_trace_id: "trace_1",
      connected_source_port_ids: ["port_sda", "port_scl"],
      connected_source_net_ids: [],
    },
  ] as AnyCircuitElement[]

  const errors = checkInvalidPinConnections(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toBe("I2C SDA and SCL pins are connected together")
  expect(errors[0].source_port_ids).toContain("port_sda")
  expect(errors[0].source_port_ids).toContain("port_scl")
})

test("checkInvalidPinConnections allows SDA connected to SDA", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_port",
      source_port_id: "port_sda1",
      name: "SDA1",
      is_configured_for_i2c_sda: true,
    },
    {
      type: "source_port",
      source_port_id: "port_sda2",
      name: "SDA2",
      is_configured_for_i2c_sda: true,
    },
    {
      type: "source_trace",
      source_trace_id: "trace_1",
      connected_source_port_ids: ["port_sda1", "port_sda2"],
      connected_source_net_ids: [],
    },
  ] as AnyCircuitElement[]

  const errors = checkInvalidPinConnections(circuitJson)
  expect(errors).toHaveLength(0)
})
