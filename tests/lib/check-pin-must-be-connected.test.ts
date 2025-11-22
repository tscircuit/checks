import { describe, expect, test } from "bun:test"
import { checkPinMustBeConnected } from "lib/check-pin-must-be-connected"
import type { AnyCircuitElement } from "circuit-json"

describe("checkPinMustBeConnected", () => {
  test("returns error when pin with must_be_connected is not connected", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "component_1",
        name: "U1",
      } as any,
      {
        type: "source_port",
        source_port_id: "port_1",
        source_component_id: "component_1",
        name: "pin1",
        must_be_connected: true,
      } as any,
    ]

    const errors = checkPinMustBeConnected(circuitJson)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("pin1")
    expect(errors[0].message).toContain("U1")
    expect(errors[0].message).toContain("must be connected but is floating")
    expect(errors[0].source_component_id).toBe("component_1")
    expect(errors[0].source_port_id).toBe("port_1")
  })

  test("returns no error when pin with must_be_connected is connected", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "component_1",
        name: "U1",
      } as any,
      {
        type: "source_port",
        source_port_id: "port_1",
        source_component_id: "component_1",
        name: "pin1",
        must_be_connected: true,
      } as any,
      {
        type: "source_trace",
        source_trace_id: "trace_1",
        connected_source_port_ids: ["port_1", "port_2"],
        connected_source_net_ids: [],
      } as any,
    ]

    const errors = checkPinMustBeConnected(circuitJson)
    expect(errors).toHaveLength(0)
  })

  test("returns no error when pin does not have must_be_connected attribute", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "component_1",
        name: "U1",
      } as any,
      {
        type: "source_port",
        source_port_id: "port_1",
        source_component_id: "component_1",
        name: "pin1",
      } as any,
    ]

    const errors = checkPinMustBeConnected(circuitJson)
    expect(errors).toHaveLength(0)
  })

  test("returns no error when pin with must_be_connected is internally connected to a connected pin", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "component_1",
        name: "U1",
        internally_connected_source_port_ids: [["port_1", "port_2"]],
      } as any,
      {
        type: "source_port",
        source_port_id: "port_1",
        source_component_id: "component_1",
        name: "pin1",
        must_be_connected: true,
      } as any,
      {
        type: "source_port",
        source_port_id: "port_2",
        source_component_id: "component_1",
        name: "pin2",
      } as any,
      {
        type: "source_trace",
        source_trace_id: "trace_1",
        connected_source_port_ids: ["port_2", "port_3"],
        connected_source_net_ids: [],
      } as any,
    ]

    const errors = checkPinMustBeConnected(circuitJson)
    expect(errors).toHaveLength(0)
  })

  test("returns errors for multiple unconnected pins with must_be_connected", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "component_1",
        name: "U1",
      } as any,
      {
        type: "source_port",
        source_port_id: "port_1",
        source_component_id: "component_1",
        name: "pin1",
        must_be_connected: true,
      } as any,
      {
        type: "source_port",
        source_port_id: "port_2",
        source_component_id: "component_1",
        name: "pin2",
        must_be_connected: true,
      } as any,
    ]

    const errors = checkPinMustBeConnected(circuitJson)
    expect(errors).toHaveLength(2)
    expect(errors[0].message).toContain("pin1")
    expect(errors[1].message).toContain("pin2")
  })

  test("includes subcircuit_id in error when port has one", () => {
    const circuitJson: AnyCircuitElement[] = [
      {
        type: "source_component",
        source_component_id: "component_1",
        name: "U1",
      } as any,
      {
        type: "source_port",
        source_port_id: "port_1",
        source_component_id: "component_1",
        name: "pin1",
        subcircuit_id: "subcircuit_1",
        must_be_connected: true,
      } as any,
    ]

    const errors = checkPinMustBeConnected(circuitJson)
    expect(errors).toHaveLength(1)
    expect(errors[0].subcircuit_id).toBe("subcircuit_1")
  })
})
