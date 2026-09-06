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

test("warns with a component reference and assignment instructions", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <schematicsheet name="Controller" displayName="Controller" />
      <resistor name="R1" resistance="1k" />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const original = structuredClone(circuitJson)
  const component = circuitJson.find(
    (element) => element.type === "schematic_component",
  )
  expect(component).toBeDefined()
  const warnings = checkSchematicComponentMissingSheet(circuitJson)
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    type: "schematic_component_styling_warning",
    styling_issue_type: "missing_schematic_sheet",
    schematic_component_id: component!.schematic_component_id,
    source_component_id: component!.source_component_id,
    subcircuit_id: component!.subcircuit_id,
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

test("requires a sheet even when the circuit has not declared any", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <resistor name="R1" resistance="1k" />
    </board>,
  )
  await circuit.renderUntilSettled()
  const warnings = checkSchematicComponentMissingSheet(circuit.getCircuitJson())
  expect(warnings).toHaveLength(1)
  expect(warnings[0].message).toBe(
    "R1 is not assigned to a schematic sheet. Add a <schematicsheet> and set schSheetName to its name.",
  )
  expect(
    (await runAllSchematicChecks(circuit.getCircuitJson())).some(
      (warning) => warning.styling_issue_type === "missing_schematic_sheet",
    ),
  ).toBe(true)
})

test("accepts components explicitly assigned to different sheets", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <schematicsheet name="Controller" displayName="Controller" />
      <schematicsheet name="Power" displayName="Power" />
      <resistor name="R1" resistance="1k" schSheetName="Controller" />
      <capacitor name="C1" capacitance="100nF" schSheetName="Power" />
    </board>,
  )
  await circuit.renderUntilSettled()
  const schematicComponents = circuit
    .getCircuitJson()
    .filter((element) => element.type === "schematic_component")
  expect(schematicComponents).toHaveLength(2)
  expect(
    new Set(
      schematicComponents.map((component) => component.schematic_sheet_id),
    ).size,
  ).toBe(2)
  expect(checkSchematicComponentMissingSheet(circuit.getCircuitJson())).toEqual(
    [],
  )
})

test("does not warn for an empty sheet", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <schematicsheet name="Controller" displayName="Controller" />
    </board>,
  )
  await circuit.renderUntilSettled()
  expect(
    circuit
      .getCircuitJson()
      .filter((element) => element.type === "schematic_sheet"),
  ).toHaveLength(1)
  expect(checkSchematicComponentMissingSheet(circuit.getCircuitJson())).toEqual(
    [],
  )
})

test("returns one warning per unassigned component", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <schematicsheet name="Controller" displayName="Controller" />
      <resistor name="R1" resistance="1k" schX={0} />
      <capacitor name="C1" capacitance="100nF" schX={3} />
      <resistor name="R2" resistance="10k" schSheetName="Controller" />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const warnings = checkSchematicComponentMissingSheet(circuitJson)
  expect(warnings).toHaveLength(2)
  const unassignedComponents = circuitJson
    .filter((element) => element.type === "schematic_component")
    .filter((component) => !component.schematic_sheet_id)
  expect(warnings.map((warning) => warning.schematic_component_id)).toEqual(
    unassignedComponents.map((component) => component.schematic_component_id),
  )
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
  let pullupSheet: string | undefined
  if (assigned) pullupSheet = "Controller"
  return (
    <board routingDisabled schMaxTraceDistance={0.6}>
      <schematicsheet
        name="Controller"
        displayName="Controller / power and sensor interface"
      />
      <group name="controller" schSheetName="Controller">
        <chip
          name="J1"
          schX={-9}
          schY={1}
          schWidth={1.2}
          schHeight={1}
          pinLabels={{ pin1: "5V", pin2: "GND" }}
          schPinArrangement={{ rightSide: ["pin1", "pin2"] }}
          connections={{ pin1: "net.VIN", pin2: "net.GND" }}
        />
        <chip
          name="U1"
          schX={-6}
          schY={2}
          schWidth={2}
          schHeight={1.5}
          pinLabels={{ pin1: "IN", pin2: "GND", pin3: "OUT" }}
          schPinArrangement={{
            leftSide: ["pin1"],
            rightSide: ["pin3"],
            bottomSide: ["pin2"],
          }}
          connections={{ pin1: "net.VIN", pin2: "net.GND", pin3: "net.V3V3" }}
        />
        <capacitor
          name="C1"
          capacitance="1uF"
          schX={-8}
          schY={-1}
          schOrientation="vertical"
          connections={{ pin1: "net.VIN", pin2: "net.GND" }}
        />
        <capacitor
          name="C2"
          capacitance="1uF"
          schX={-5}
          schY={-1}
          schOrientation="vertical"
          connections={{ pin1: "net.V3V3", pin2: "net.GND" }}
        />
        <chip
          name="U2"
          schX={0}
          schY={0}
          schWidth={2.4}
          schHeight={2.6}
          pinLabels={{
            pin1: "VDD",
            pin2: "GND",
            pin3: "SCL",
            pin4: "SDA",
            pin5: "RESET",
          }}
          schPinArrangement={{
            topSide: ["pin1"],
            bottomSide: ["pin2"],
            rightSide: ["pin3", "pin4"],
            leftSide: ["pin5"],
          }}
          connections={{
            pin1: "net.V3V3",
            pin2: "net.GND",
            pin3: "net.SCL",
            pin4: "net.SDA",
            pin5: "net.RESET",
          }}
        />
        <capacitor
          name="C3"
          capacitance="100nF"
          schX={-2}
          schY={2.7}
          schOrientation="vertical"
          connections={{ pin1: "net.V3V3", pin2: "net.GND" }}
        />
        <resistor
          name="R3"
          resistance="10k"
          schX={-2.5}
          schY={-1}
          schRotation={90}
          connections={{ pin1: "net.V3V3", pin2: "net.RESET" }}
        />
        <resistor
          name="R1"
          resistance="4.7k"
          schX={3}
          schY={2.7}
          schRotation={90}
          connections={{ pin1: "net.V3V3", pin2: "net.SCL" }}
        />
        <chip
          name="J2"
          schX={6}
          schY={-0.5}
          schWidth={1.5}
          schHeight={2.2}
          pinLabels={{ pin1: "3V3", pin2: "GND", pin3: "SCL", pin4: "SDA" }}
          schPinArrangement={{
            leftSide: ["pin1", "pin2", "pin3", "pin4"],
          }}
          connections={{
            pin1: "net.V3V3",
            pin2: "net.GND",
            pin3: "net.SCL",
            pin4: "net.SDA",
          }}
        />
        <schematictext
          text="3.3 V REGULATOR"
          schX={-6.5}
          schY={4}
          fontSize={0.25}
        />
        <schematictext
          text="MCU / RESET / DECOUPLING"
          schX={-0.5}
          schY={4}
          fontSize={0.25}
        />
        <schematictext
          text="I2C SENSOR INTERFACE"
          schX={5}
          schY={4}
          fontSize={0.25}
        />
      </group>
      <resistor
        name="R2"
        resistance="4.7k"
        schSheetName={pullupSheet}
        schX={5}
        schY={2.7}
        schRotation={90}
        connections={{ pin1: "net.V3V3", pin2: "net.SDA" }}
      />
      <group name="sheetHeading" schSheetName="Controller">
        <schematictext
          text="CONTROLLER — 5 V INPUT / 3.3 V LOGIC / I2C EXPANSION"
          schX={-1}
          schY={5.2}
          fontSize={0.32}
          color="#174e75"
        />
        <schematictext
          text="Controller / sheet 1"
          schX={-1}
          schY={4.6}
          fontSize={0.18}
          color="#174e75"
        />
      </group>
      {note && (
        <>
          <schematictext
            text="UNASSIGNED COMPONENT — excluded from the sheet above"
            schX={1}
            schY={4}
            fontSize={0.25}
            color="#b45309"
          />
          <schematictext
            text={note}
            schX={0}
            schY={0}
            fontSize={0.2}
            color="#b45309"
          />
          <schematicpath
            strokeColor="#b45309"
            strokeWidth={0.035}
            points={[
              { x: 6, y: 0.4 },
              { x: 6, y: 2.7 },
              { x: 5.5, y: 2.7 },
            ]}
          />
          <schematicpath
            strokeColor="#b45309"
            strokeWidth={0.035}
            points={[
              { x: 5.7, y: 2.85 },
              { x: 5.5, y: 2.7 },
              { x: 5.7, y: 2.55 },
            ]}
          />
        </>
      )}
      {assigned && (
        <group name="sheetStatus" schSheetName="Controller">
          <schematictext
            text="All 10 components belong to Controller — ready for sheet export"
            schX={-1}
            schY={-4}
            fontSize={0.24}
            color="#15803d"
          />
        </group>
      )}
    </board>
  )
}

function renderSheetWithUnassignedComponents(circuitJson: AnyCircuitElement[]) {
  const sheetSvg = convertCircuitJsonToSchematicSvg(circuitJson, {
    width: 1600,
    height: 1100,
  })
  const unassignedElements = circuitJson.filter((element) => {
    switch (element.type) {
      case "schematic_component":
      case "schematic_port":
      case "schematic_text":
      case "schematic_path":
      case "schematic_trace":
      case "schematic_net_label":
        return !element.schematic_sheet_id
      case "source_component":
        return true
      default:
        return false
    }
  })
  const unassignedSvg = convertCircuitJsonToSchematicSvg(unassignedElements, {
    width: 1600,
    height: 400,
  })
  // Preserve the native sheet renderer; show excluded components in a separate diagnostic panel.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1500">${sheetSvg}<g transform="translate(0,1100)">${unassignedSvg}</g></svg>`
}

test("shows a warning note pointing to the unassigned component, then clears after assignment", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(<SheetAssignmentExample />)
  await circuit.renderUntilSettled()
  const schematicComponents = circuit
    .getCircuitJson()
    .filter((element) => element.type === "schematic_component")
  expect(schematicComponents).toHaveLength(10)
  expect(
    schematicComponents.filter((component) => component.schematic_sheet_id),
  ).toHaveLength(9)
  const warnings = checkSchematicComponentMissingSheet(circuit.getCircuitJson())
  expect(warnings).toHaveLength(1)
  const sourceResistor = circuit
    .getCircuitJson()
    .filter((element) => element.type === "source_component")
    .find((element) => element.name === "R2")
  expect(warnings[0].source_component_id).toBe(
    sourceResistor?.source_component_id,
  )

  const annotated = new Circuit()
  annotated.pcbDisabled = true
  annotated.add(<SheetAssignmentExample note={warnings[0].message} />)
  await annotated.renderUntilSettled()
  expect(
    renderSheetWithUnassignedComponents(annotated.getCircuitJson()),
  ).toMatchSvgSnapshot(import.meta.path, "unassigned-warning")

  const assigned = new Circuit()
  assigned.pcbDisabled = true
  assigned.add(<SheetAssignmentExample assigned />)
  await assigned.renderUntilSettled()
  const assignedComponents = assigned
    .getCircuitJson()
    .filter((element) => element.type === "schematic_component")
  expect(assignedComponents).toHaveLength(10)
  expect(
    assignedComponents.every((component) => component.schematic_sheet_id),
  ).toBe(true)
  expect(
    checkSchematicComponentMissingSheet(assigned.getCircuitJson()),
  ).toEqual([])
  expect(
    convertCircuitJsonToSchematicSvg(assigned.getCircuitJson(), {
      width: 1600,
      height: 1100,
    }),
  ).toMatchSvgSnapshot(import.meta.path, "assigned")
})
