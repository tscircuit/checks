import { expect, test } from "bun:test"
import { checkI2cSdaConnectedToSclMisconfigured } from "../../lib/check-i2c-sda-connected-to-scl"
import type { AnyCircuitElement } from "circuit-json"

test("checkI2cSdaConnectedToSclMisconfigured detects SDA connected to SCL", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_port",
      source_port_id: "port_sda",
      name: "SDA",
      is_configured_for_i2c_sda: true,
      source_component_id: "comp_1"
    },
    {
      type: "source_component",
      source_component_id: "comp_1",
      name: "U1",
    },
    {
      type: "source_port",
      source_port_id: "port_scl",
      name: "SCL",
      is_configured_for_i2c_scl: true,
      source_component_id: "comp_2"
    },
    {
      type: "source_component",
      source_component_id: "comp_2",
      name: "U2",
    },
    {
      type: "source_trace",
      source_trace_id: "trace_1",
      connected_source_port_ids: ["port_sda", "port_scl"],
      connected_source_net_ids: [],
    },
  ] as AnyCircuitElement[]

  const errors = checkI2cSdaConnectedToSclMisconfigured(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toEqual(expect.stringContaining("U2.SCL (I2C SCL)"))
  expect(errors[0].message).toEqual(expect.stringContaining("U1.SDA (I2C SDA)"))
  expect(errors[0].source_port_ids).toContain("port_sda")
  expect(errors[0].source_port_ids).toContain("port_scl")
})

test("checkI2cSdaConnectedToSclMisconfigured allows SDA connected to SDA", () => {
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

  const errors = checkI2cSdaConnectedToSclMisconfigured(circuitJson)
  expect(errors).toHaveLength(0)
})
