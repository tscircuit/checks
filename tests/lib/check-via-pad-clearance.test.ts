import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkViaPadClearance } from "../../lib/check-via-pad-clearance"

const makeBoard = (): AnyCircuitElement =>
  ({
    type: "pcb_board",
    pcb_board_id: "board1",
    width: 100,
    height: 100,
    x: 0,
    y: 0,
  }) as AnyCircuitElement

const makeVia = (id: string, x: number, y: number): AnyCircuitElement =>
  ({
    type: "pcb_via",
    pcb_via_id: id,
    x,
    y,
    outer_diameter: 1.0,
    hole_diameter: 0.4,
    layers: ["top", "bottom"],
  }) as AnyCircuitElement

const makeCirclePad = (id: string, x: number, y: number): AnyCircuitElement =>
  ({
    type: "pcb_smtpad",
    pcb_smtpad_id: id,
    pcb_component_id: "comp1",
    pcb_port_id: `port_${id}`,
    shape: "circle",
    x,
    y,
    radius: 0.5,
    layer: "top",
  }) as AnyCircuitElement

const makeRectPad = (id: string, x: number, y: number): AnyCircuitElement =>
  ({
    type: "pcb_smtpad",
    pcb_smtpad_id: id,
    pcb_component_id: "comp1",
    pcb_port_id: `port_${id}`,
    shape: "rect",
    x,
    y,
    width: 1.0,
    height: 1.0,
    layer: "top",
  }) as AnyCircuitElement

const makePlatedHole = (id: string, x: number, y: number): AnyCircuitElement =>
  ({
    type: "pcb_plated_hole",
    pcb_plated_hole_id: id,
    pcb_component_id: "comp1",
    pcb_port_id: `port_${id}`,
    shape: "circle",
    x,
    y,
    hole_diameter: 0.8,
    outer_diameter: 1.2,
    layers: ["top", "bottom"],
  }) as AnyCircuitElement

test("via too close to circle pad should produce error", () => {
  const circuitJson: AnyCircuitElement[] = [
    makeBoard(),
    makeVia("via1", 0, 0),
    // via radius=0.5, pad radius=0.5, distance=1.05 => gap=0.05mm < 0.1mm default
    makeCirclePad("pad1", 1.05, 0),
  ]
  const errors = checkViaPadClearance(circuitJson)
  expect(errors.length).toBeGreaterThan(0)
  expect(errors[0].type).toBe("pcb_via_pad_clearance_error")
  expect(errors[0].pcb_via_id).toBe("via1")
  expect(errors[0].pcb_pad_id).toBe("pad1")
})

test("via far from pad should not produce error", () => {
  const circuitJson: AnyCircuitElement[] = [
    makeBoard(),
    makeVia("via1", 0, 0),
    makeCirclePad("pad1", 10, 0),
  ]
  const errors = checkViaPadClearance(circuitJson)
  expect(errors.length).toBe(0)
})

test("via too close to rect pad should produce error", () => {
  const circuitJson: AnyCircuitElement[] = [
    makeBoard(),
    makeVia("via1", 0, 0),
    // via radius=0.5, rect half-width=0.5, center at 1.04
    // rect nearest edge at x=0.54, gap≈0.04mm < 0.1mm default
    makeRectPad("pad1", 1.04, 0),
  ]
  const errors = checkViaPadClearance(circuitJson)
  expect(errors.length).toBeGreaterThan(0)
})

test("via too close to plated hole should produce error", () => {
  const circuitJson: AnyCircuitElement[] = [
    makeBoard(),
    makeVia("via1", 0, 0),
    // via radius=0.5, plated_hole outer radius=0.6, distance=1.14
    // gap=1.14-0.5-0.6=0.04mm < 0.1mm default
    makePlatedHole("ph1", 1.14, 0),
  ]
  const errors = checkViaPadClearance(circuitJson)
  expect(errors.length).toBeGreaterThan(0)
})

test("custom minClearance is respected", () => {
  const circuitJson: AnyCircuitElement[] = [
    makeBoard(),
    makeVia("via1", 0, 0),
    makeCirclePad("pad1", 3, 0), // gap = 3 - 0.5 - 0.5 = 2.0mm (passes default)
  ]
  // Default clearance (~0.1mm) should pass
  const defaultErrors = checkViaPadClearance(circuitJson)
  expect(defaultErrors.length).toBe(0)

  // Very large minClearance should fail
  const customErrors = checkViaPadClearance(circuitJson, {
    minClearance: 5,
  })
  expect(customErrors.length).toBeGreaterThan(0)
})

test("no vias returns empty", () => {
  const circuitJson: AnyCircuitElement[] = [
    makeBoard(),
    makeCirclePad("pad1", 0, 0),
  ]
  const errors = checkViaPadClearance(circuitJson)
  expect(errors.length).toBe(0)
})

test("no pads returns empty", () => {
  const circuitJson: AnyCircuitElement[] = [
    makeBoard(),
    makeVia("via1", 0, 0),
  ]
  const errors = checkViaPadClearance(circuitJson)
  expect(errors.length).toBe(0)
})
