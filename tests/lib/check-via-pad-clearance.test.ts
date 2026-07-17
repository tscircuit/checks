import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaPadClearance } from "../../lib/check-via-pad-clearance"

const rectPad = (id: string, x: number, y: number): AnyCircuitElement =>
  ({
    type: "pcb_smtpad",
    pcb_smtpad_id: id,
    pcb_component_id: "comp1",
    pcb_port_id: `port_${id}`,
    shape: "rect",
    x,
    y,
    width: 1,
    height: 1,
    layer: "top",
  }) as AnyCircuitElement

const via = (id: string, x: number, y: number): AnyCircuitElement =>
  ({
    type: "pcb_via",
    pcb_via_id: id,
    x,
    y,
    hole_diameter: 0.3,
    outer_diameter: 0.4,
    layers: ["top", "bottom"],
  }) as AnyCircuitElement

// Stub: nothing is connected unless the two ids are identical.
const unconnected = {
  areIdsConnected: (a: string, b: string) => a === b,
} as any

test("checkViaPadClearance flags a via too close to an unrelated pad", () => {
  const circuitJson: AnyCircuitElement[] = [
    rectPad("pad1", 0, 0),
    via("via1", 0.55, 0),
  ]

  const errors = checkViaPadClearance(circuitJson, { connMap: unconnected })

  expect(errors).toHaveLength(1)
  expect(errors[0].type).toBe("pcb_via_pad_clearance_error")
  expect(errors[0].pcb_via_id).toBe("via1")
  expect(errors[0].pcb_pad_id).toBe("pad1")
  expect(errors[0].actual_clearance).toBeLessThan(errors[0].minimum_clearance)
})

test("checkViaPadClearance ignores a via far away from the pad", () => {
  const circuitJson: AnyCircuitElement[] = [
    rectPad("pad1", 0, 0),
    via("via1", 5, 5),
  ]

  expect(
    checkViaPadClearance(circuitJson, { connMap: unconnected }),
  ).toHaveLength(0)
})

test("checkViaPadClearance ignores a via connected to the pad's net", () => {
  const circuitJson: AnyCircuitElement[] = [
    rectPad("pad1", 0, 0),
    via("via1", 0.55, 0),
  ]
  const connected = { areIdsConnected: () => true } as any

  expect(
    checkViaPadClearance(circuitJson, { connMap: connected }),
  ).toHaveLength(0)
})

test("checkViaPadClearance respects a custom minClearance", () => {
  const circuitJson: AnyCircuitElement[] = [
    rectPad("pad1", 0, 0),
    // Edge-to-edge gap is ~0.3mm here.
    via("via1", 1.0, 0),
  ]

  expect(
    checkViaPadClearance(circuitJson, {
      connMap: unconnected,
      minClearance: 0.1,
    }),
  ).toHaveLength(0)
  expect(
    checkViaPadClearance(circuitJson, {
      connMap: unconnected,
      minClearance: 1,
    }),
  ).toHaveLength(1)
})
