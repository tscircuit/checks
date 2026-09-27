import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkViaPadClearance } from "../../lib/check-via-pad-clearance"
import mpu6050CircuitJson from "../assets/mpu6050-mini-fresh.circuit.json"

// Exported from the complete MPU-6050 board with tscircuit@0.0.2565.
// The router placed pcb_via_8 beside C3 pin 2, but reported zero DRC errors.
const circuitJson = mpu6050CircuitJson as AnyCircuitElement[]
const minClearance = 0.1

function findCircuitElement<Type extends AnyCircuitElement["type"]>(
  type: Type,
  predicate: (element: Extract<AnyCircuitElement, { type: Type }>) => boolean,
) {
  return circuitJson
    .filter(
      (element): element is Extract<AnyCircuitElement, { type: Type }> =>
        element.type === type,
    )
    .find(predicate)
}

function getViaAndC3GndPad() {
  const board = findCircuitElement("pcb_board", () => true)
  const c3 = findCircuitElement(
    "source_component",
    (element) => element.name === "C3",
  )
  const c3Pin2 = findCircuitElement(
    "source_port",
    (element) =>
      element.source_component_id === c3?.source_component_id &&
      element.name === "pin2",
  )
  const c3PcbPort = findCircuitElement(
    "pcb_port",
    (element) => element.source_port_id === c3Pin2?.source_port_id,
  )
  const c3GndPad = findCircuitElement(
    "pcb_smtpad",
    (element) => element.pcb_port_id === c3PcbPort?.pcb_port_id,
  )
  const via = findCircuitElement(
    "pcb_via",
    (element) => element.pcb_via_id === "pcb_via_8",
  )
  const gnd = findCircuitElement(
    "source_net",
    (element) => element.name === "GND",
  )
  const v3v3 = findCircuitElement(
    "source_net",
    (element) => element.name === "V3V3",
  )

  if (!board || !c3Pin2 || !c3GndPad || !via || !gnd || !v3v3) {
    throw new Error("The MPU-6050 Circuit JSON fixture is incomplete")
  }
  if (c3GndPad.shape !== "rect") {
    throw new Error("Expected C3 pin 2 to be a rectangular pad")
  }

  return { board, c3Pin2, c3GndPad, via, gnd, v3v3 }
}

test("MPU-6050 fixture has a V3V3 via within 0.1 mm of C3 GND", () => {
  const { board, c3Pin2, c3GndPad, via, gnd, v3v3 } = getViaAndC3GndPad()

  expect(board.min_pad_edge_to_pad_edge_clearance).toBe(minClearance)
  expect(c3Pin2.subcircuit_connectivity_map_key).toBe(
    gnd.subcircuit_connectivity_map_key,
  )
  expect(via.subcircuit_connectivity_map_key).toBe(
    v3v3.subcircuit_connectivity_map_key,
  )
  expect(via.layers).toContain(c3GndPad.layer)

  // Circle-to-axis-aligned-rectangle gap, calculated independently of the
  // checker's getPadToPadGap helper.
  const dx = Math.max(Math.abs(via.x - c3GndPad.x) - c3GndPad.width / 2, 0)
  const dy = Math.max(Math.abs(via.y - c3GndPad.y) - c3GndPad.height / 2, 0)
  const gap = Math.hypot(dx, dy) - via.outer_diameter / 2
  expect(gap).toBeCloseTo(0.0972614961, 6)
  expect(gap).toBeLessThan(minClearance)

  // A normal test checks that the checker runs and that the board snapshot
  // renders. A render failure cannot satisfy the expected-failure test below.
  const errors = checkViaPadClearance(circuitJson, { minClearance })
  expect(errors.length).toBeLessThanOrEqual(1)
  for (const error of errors) {
    expect(error.pcb_pad_ids).toEqual([via.pcb_via_id, c3GndPad.pcb_smtpad_id])
  }
  const annotatedCircuitJson: AnyCircuitElement[] = [
    ...circuitJson,
    {
      type: "pcb_note_text",
      pcb_note_text_id: "mpu6050_clearance_note",
      text: `V3V3 via to C3 pin 2: ${gap.toFixed(4)}mm < ${minClearance}mm`,
      anchor_position: { x: 0, y: -5.5 },
      anchor_alignment: "center",
      font: "tscircuit2024",
      font_size: 0.18,
      layer: "top",
      color: "#fbbf24",
    },
  ]
  expect(convertCircuitJsonToPcbSvg(annotatedCircuitJson)).toMatchSvgSnapshot(
    import.meta.path,
  )
})

test.failing("MPU-6050 via-to-pad clearance should be reported", () => {
  const { via, c3GndPad } = getViaAndC3GndPad()
  const errors = checkViaPadClearance(circuitJson, { minClearance })
  expect(errors).toHaveLength(1)
  expect(errors[0]?.pcb_pad_ids).toEqual([
    via.pcb_via_id,
    c3GndPad.pcb_smtpad_id,
  ])
})
