import { describe, expect, test } from "bun:test"
import { any_circuit_element, type AnyCircuitElement } from "circuit-json"
import { checkPcbComponentsMissingCourtyard } from "lib/check-pcb-components-missing-courtyard"
import { containsCircuitJsonId } from "lib/util/get-readable-names"

describe("checkPcbComponentsMissingCourtyard", () => {
  test.each(["pad", "through_hole"])(
    "does not warn for a %s test point without a courtyard",
    (footprintVariant) => {
      const circuitJson = [
        {
          type: "pcb_component",
          pcb_component_id: "pcb_component_test_point",
          source_component_id: "source_component_test_point",
          center: { x: 0, y: 0 },
        },
        {
          type: "source_component",
          source_component_id: "source_component_test_point",
          ftype: "simple_test_point",
          name: "Probe",
          footprint_variant: footprintVariant,
          supplier_part_numbers: {},
        },
      ] as unknown as AnyCircuitElement[]

      expect(checkPcbComponentsMissingCourtyard(circuitJson)).toHaveLength(0)
    },
  )

  test("only exempts test points in a mixed circuit", () => {
    const circuitJson = [
      {
        type: "source_component",
        source_component_id: "source_component_test_point",
        ftype: "simple_test_point",
        name: "",
        supplier_part_numbers: {},
      },
      {
        type: "pcb_component",
        pcb_component_id: "pcb_component_test_point",
        source_component_id: "source_component_test_point",
        center: { x: 0, y: 0 },
      },
      {
        type: "source_component",
        source_component_id: "source_component_resistor",
        ftype: "simple_resistor",
        name: "TP2",
        resistance: 1000,
        supplier_part_numbers: {},
      },
      {
        type: "pcb_component",
        pcb_component_id: "pcb_component_resistor",
        source_component_id: "source_component_resistor",
        center: { x: 2, y: 0 },
      },
      {
        type: "pcb_component",
        pcb_component_id: "pcb_component_unnamed",
        center: { x: 4, y: 0 },
      },
    ] as unknown as AnyCircuitElement[]

    const warnings = checkPcbComponentsMissingCourtyard(circuitJson)

    expect(warnings).toMatchObject([
      {
        pcb_component_id: "pcb_component_resistor",
        message: "TP2 has no courtyard",
      },
      {
        pcb_component_id: "pcb_component_unnamed",
        message: "unnamed component has no courtyard",
      },
    ])
    expect(
      warnings.every((warning) => !containsCircuitJsonId(warning.message)),
    ).toBe(true)
  })

  test("returns a warning when a component has no courtyard", () => {
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
    ] as unknown as AnyCircuitElement[]

    const warnings = checkPcbComponentsMissingCourtyard(circuitJson)

    expect(warnings).toEqual([
      expect.objectContaining({
        type: "pcb_component_missing_courtyard_warning",
        pcb_component_id: "pcb_component_1",
        source_component_id: "source_component_1",
        message: "R1 has no courtyard",
      }),
    ])
    expect(containsCircuitJsonId(warnings[0]!.message)).toBe(false)
    expect(any_circuit_element.safeParse(warnings[0]).success).toBe(true)
  })

  test.each([
    { name: "", expected: "unnamed component" },
    { name: "source_component_resistor", expected: "unnamed component" },
    { name: "R1", expected: "R1" },
  ])("uses a readable name for a source component named '$name'", ({
    name,
    expected,
  }) => {
    const circuitJson = [
      {
        type: "source_component",
        source_component_id: "source_component_resistor",
        ftype: "simple_resistor",
        name,
        resistance: 1000,
        supplier_part_numbers: {},
      },
      {
        type: "pcb_component",
        pcb_component_id: "pcb_component_resistor",
        source_component_id: "source_component_resistor",
        center: { x: 0, y: 0 },
      },
    ] as unknown as AnyCircuitElement[]

    const warnings = checkPcbComponentsMissingCourtyard(circuitJson)

    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.message).toBe(`${expected} has no courtyard`)
    expect(containsCircuitJsonId(warnings[0]!.message)).toBe(false)
  })

  test("does not warn when a component has a courtyard", () => {
    const circuitJson = [
      {
        type: "pcb_component",
        pcb_component_id: "pcb_component_1",
        center: { x: 0, y: 0 },
      },
      {
        type: "pcb_courtyard_rect",
        pcb_courtyard_rect_id: "courtyard_1",
        pcb_component_id: "pcb_component_1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        layer: "top_courtyard",
      },
    ] as unknown as AnyCircuitElement[]

    expect(checkPcbComponentsMissingCourtyard(circuitJson)).toHaveLength(0)
  })
})
