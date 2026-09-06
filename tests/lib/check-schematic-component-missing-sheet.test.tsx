import { expect, test } from "bun:test"
import {
  type AnyCircuitElement,
  schematic_component_styling_warning,
} from "circuit-json"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import {
  checkSchematicComponentMissingSheet,
  runAllSchematicChecks,
} from "../../index"
import { Circuit } from "tscircuit"

const components: AnyCircuitElement[] = [
  {
    type: "source_component",
    source_component_id: "source-r1",
    name: "R1",
    ftype: "simple_resistor",
    resistance: 1000,
  },
  {
    type: "schematic_component",
    schematic_component_id: "schematic-r1",
    source_component_id: "source-r1",
    center: { x: 0, y: 0 },
    size: { width: 1, height: 0.3 },
    is_box_with_pins: false,
    subcircuit_id: "controller",
  },
]
const sheet: AnyCircuitElement = {
  type: "schematic_sheet",
  schematic_sheet_id: "controller-sheet",
  name: "Controller",
  subcircuit_id: "controller",
}

test("warns with a component reference and assignment instructions", async () => {
  const circuitJson = [...components, sheet]
  const original = structuredClone(circuitJson)
  const warnings = checkSchematicComponentMissingSheet(circuitJson)
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    type: "schematic_component_styling_warning",
    styling_issue_type: "missing_schematic_sheet",
    schematic_component_id: "schematic-r1",
    source_component_id: "source-r1",
    subcircuit_id: "controller",
    message:
      "R1 is not assigned to a schematic sheet. Set schSheetName to an existing sheet name.",
  })
  expect(
    schematic_component_styling_warning.safeParse(warnings[0]).success,
  ).toBe(true)
  expect(warnings[0].schematic_sheet_id).toBeUndefined()
  expect(circuitJson).toEqual(original)
  expect(
    (await runAllSchematicChecks(circuitJson)).some(
      (warning) => warning.styling_issue_type === "missing_schematic_sheet",
    ),
  ).toBe(true)
})

test("does not require sheets in an ordinary single-canvas circuit", () => {
  expect(checkSchematicComponentMissingSheet(components)).toEqual([])
  expect(checkSchematicComponentMissingSheet([])).toEqual([])
})

test("ignores assigned components and schematic group representations", () => {
  const assigned = components.map((component) => {
    if (component.type !== "schematic_component") return component
    return { ...component, schematic_sheet_id: sheet.schematic_sheet_id }
  })
  expect(checkSchematicComponentMissingSheet([...assigned, sheet])).toEqual([])
  const groups = components.map((component) => {
    if (component.type !== "schematic_component") return component
    return { ...component, is_schematic_group: true }
  })
  expect(checkSchematicComponentMissingSheet([...groups, sheet])).toEqual([])
})

test("identifies components even without source metadata", () => {
  const schematicOnly = components.filter(
    (component) => component.type === "schematic_component",
  )
  expect(
    checkSchematicComponentMissingSheet([...schematicOnly, sheet])[0].message,
  ).toContain("schematic-r1 is not assigned")
})

test("returns one warning per unassigned component", () => {
  const secondComponent: AnyCircuitElement = {
    type: "schematic_component",
    schematic_component_id: "schematic-c1",
    center: { x: 2, y: 0 },
    size: { width: 1, height: 0.3 },
    is_box_with_pins: false,
  }
  const warnings = checkSchematicComponentMissingSheet([
    ...components,
    secondComponent,
    sheet,
  ])
  expect(warnings.map((warning) => warning.schematic_component_id)).toEqual([
    "schematic-r1",
    "schematic-c1",
  ])
  expect(
    new Set(
      warnings.map((warning) => warning.schematic_component_styling_warning_id),
    ).size,
  ).toBe(2)
})

test("accepts sheet assignments inherited from a group", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <schematicsheet name="Power" displayName="Power" />
      <group name="supply" schSheetName="Power">
        <capacitor name="C1" capacitance="100nF" />
      </group>
    </board>,
  )
  await circuit.renderUntilSettled()
  const schematicComponents = circuit
    .getCircuitJson()
    .filter((element) => element.type === "schematic_component")
  expect(schematicComponents.length).toBeGreaterThan(0)
  expect(
    schematicComponents.every((component) => component.schematic_sheet_id),
  ).toBe(true)
  expect(checkSchematicComponentMissingSheet(circuit.getCircuitJson())).toEqual(
    [],
  )
})

const SheetAssignmentExample = ({
  assigned = false,
  note,
}: { assigned?: boolean; note?: string }) => {
  let resistorSheet: string | undefined
  if (assigned) resistorSheet = "Controller"
  return (
    <board routingDisabled>
      <schematicsheet name="Controller" displayName="Controller" />
      <chip
        name="U1"
        schSheetName="Controller"
        schX={-3}
        schY={1}
        schWidth={2}
        schHeight={2}
        pinLabels={{ pin1: "IN", pin2: "OUT" }}
      />
      <resistor
        name="R1"
        resistance="1k"
        schSheetName={resistorSheet}
        schX={1}
        schY={1}
      />
      <schematictext
        text="SHEET ASSIGNMENT / CONTROLLER"
        schY={3}
        fontSize={0.25}
        color="#174e75"
      />
      <schematictext
        text="U1: assigned to Controller"
        schX={-3}
        schY={-0.5}
        fontSize={0.16}
        color="#174e75"
      />
      {note && (
        <>
          <schematictext
            text={note}
            schY={-2}
            fontSize={0.16}
            color="#b45309"
          />
          <schematicpath
            strokeColor="#b45309"
            strokeWidth={0.035}
            points={[
              { x: 0, y: -1.7 },
              { x: 1, y: -0.7 },
              { x: 1, y: 0.6 },
            ]}
          />
          <schematicpath
            strokeColor="#b45309"
            strokeWidth={0.035}
            points={[
              { x: 0.85, y: 0.4 },
              { x: 1, y: 0.6 },
              { x: 1.15, y: 0.4 },
            ]}
          />
        </>
      )}
      {assigned && (
        <schematictext
          text="PASS: all components assigned to Controller"
          schY={-2}
          fontSize={0.2}
          color="#15803d"
        />
      )}
    </board>
  )
}

test("shows a warning note pointing to the unassigned component, then clears after assignment", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(<SheetAssignmentExample />)
  await circuit.renderUntilSettled()
  const warnings = checkSchematicComponentMissingSheet(circuit.getCircuitJson())
  expect(warnings).toHaveLength(1)
  const sourceResistor = circuit
    .getCircuitJson()
    .filter((element) => element.type === "source_component")
    .find((element) => element.name === "R1")
  expect(warnings[0].source_component_id).toBe(
    sourceResistor?.source_component_id,
  )

  const annotated = new Circuit()
  annotated.pcbDisabled = true
  annotated.add(<SheetAssignmentExample note={warnings[0].message} />)
  await annotated.renderUntilSettled()
  // Overview mode keeps the unassigned component visible instead of filtering to one sheet.
  expect(
    convertCircuitJsonToSchematicSvg(
      annotated
        .getCircuitJson()
        .filter((element) => element.type !== "schematic_sheet"),
      { width: 1200, height: 600 },
    ),
  ).toMatchSvgSnapshot(import.meta.path, "unassigned-warning")

  const assigned = new Circuit()
  assigned.pcbDisabled = true
  assigned.add(<SheetAssignmentExample assigned />)
  await assigned.renderUntilSettled()
  expect(
    checkSchematicComponentMissingSheet(assigned.getCircuitJson()),
  ).toEqual([])
  expect(
    convertCircuitJsonToSchematicSvg(
      assigned
        .getCircuitJson()
        .filter((element) => element.type !== "schematic_sheet"),
      { width: 1200, height: 600 },
    ),
  ).toMatchSvgSnapshot(import.meta.path, "assigned")
})
