import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbComponentsMissingCourtyard } from "lib/check-pcb-components-missing-courtyard"

describe("checkPcbComponentsMissingCourtyard repro #3902", () => {
  // Capture the current bug: manually placed vias incorrectly require courtyards.
  // When #3902 is fixed, update these expectations to exclude via warnings.
  test("reproduces a false courtyard warning for a manually placed via", () => {
    const circuitJson = [
      {
        type: "source_manually_placed_via",
        source_manually_placed_via_id: "source_manually_placed_via_0",
        x: 0,
        y: 0,
      },
      {
        type: "pcb_component",
        pcb_component_id: "pcb_component_1",
        source_component_id: "source_manually_placed_via_0",
        center: { x: 0, y: 0 },
      },
    ] as unknown as AnyCircuitElement[]

    const warnings = checkPcbComponentsMissingCourtyard(circuitJson)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({
      type: "pcb_component_missing_courtyard_warning",
      warning_type: "pcb_component_missing_courtyard_warning",
      message: "component has no courtyard",
      pcb_component_id: "pcb_component_1",
      source_component_id: "source_manually_placed_via_0",
    })
  })

  test("reproduces an extra via warning alongside a real component warning", () => {
    const circuitJson = [
      {
        type: "source_component",
        source_component_id: "source_component_1",
        ftype: "simple_resistor",
        name: "R1",
        resistance: 1000,
        supplier_part_numbers: {},
      },
      {
        type: "pcb_component",
        pcb_component_id: "pcb_component_1",
        source_component_id: "source_component_1",
        center: { x: 0, y: 0 },
      },
      {
        type: "source_manually_placed_via",
        source_manually_placed_via_id: "source_manually_placed_via_0",
        x: 2,
        y: 2,
      },
      {
        type: "pcb_component",
        pcb_component_id: "pcb_component_2",
        source_component_id: "source_manually_placed_via_0",
        center: { x: 2, y: 2 },
      },
    ] as unknown as AnyCircuitElement[]

    const warnings = checkPcbComponentsMissingCourtyard(circuitJson)

    expect(warnings).toHaveLength(2)
    expect(warnings).toMatchObject([
      {
        message: "R1 has no courtyard",
        pcb_component_id: "pcb_component_1",
        source_component_id: "source_component_1",
      },
      {
        message: "component has no courtyard",
        pcb_component_id: "pcb_component_2",
        source_component_id: "source_manually_placed_via_0",
      },
    ])
  })

  test("captures the PCB snapshot and current courtyard warnings", () => {
    const circuitJson = [
      {
        type: "pcb_board",
        pcb_board_id: "pcb_board_0",
        center: { x: 0, y: 0 },
        width: 10,
        height: 10,
        material: "fr4",
        thickness: 1.6,
        num_layers: 2,
      },
      {
        type: "source_component",
        source_component_id: "source_component_1",
        ftype: "simple_resistor",
        name: "R1",
        resistance: 1000,
        supplier_part_numbers: {},
      },
      {
        type: "pcb_component",
        pcb_component_id: "pcb_component_1",
        source_component_id: "source_component_1",
        center: { x: 2, y: 0 },
      },
      {
        type: "source_manually_placed_via",
        source_manually_placed_via_id: "source_manually_placed_via_0",
        x: -2,
        y: 0,
      },
      {
        type: "pcb_component",
        pcb_component_id: "pcb_component_2",
        source_component_id: "source_manually_placed_via_0",
        center: { x: -2, y: 0 },
      },
      {
        type: "pcb_via",
        pcb_via_id: "pcb_via_0",
        x: -2,
        y: 0,
        layers: ["top", "bottom"],
        outer_diameter: 0.6,
        hole_diameter: 0.3,
      },
    ] as unknown as AnyCircuitElement[]

    const warnings = checkPcbComponentsMissingCourtyard(circuitJson)
    const warningsForSnapshot = warnings.map(
      ({
        subcircuit_id: _subcircuitId,
        pcb_component_missing_courtyard_warning_id: _id,
        ...warning
      }) => warning,
    )

    expect(warningsForSnapshot).toMatchInlineSnapshot(`
      [
        {
          "message": "R1 has no courtyard",
          "pcb_component_id": "pcb_component_1",
          "source_component_id": "source_component_1",
          "type": "pcb_component_missing_courtyard_warning",
          "warning_type": "pcb_component_missing_courtyard_warning",
        },
        {
          "message": "component has no courtyard",
          "pcb_component_id": "pcb_component_2",
          "source_component_id": "source_manually_placed_via_0",
          "type": "pcb_component_missing_courtyard_warning",
          "warning_type": "pcb_component_missing_courtyard_warning",
        },
      ]
    `)
    expect(
      convertCircuitJsonToPcbSvg([...circuitJson, ...warnings], {
        shouldDrawErrors: true,
      }),
    ).toMatchSvgSnapshot(import.meta.path, "repro-3902")
  })
})
