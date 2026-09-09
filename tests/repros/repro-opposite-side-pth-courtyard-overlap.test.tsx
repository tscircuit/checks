import { expect, test } from "bun:test"
import { isPointInsidePolygon } from "@tscircuit/math-utils"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { PcbFootprintOverlapError } from "circuit-json"
import { Fragment } from "react"
import { Circuit } from "tscircuit"
import { runAllPlacementChecks } from "lib/run-all-checks"

const displayPinLabels = {
  pin1: ["1"],
  pin2: ["2"],
  pin3: ["3"],
  pin4: ["4"],
  pin5: ["5"],
  pin6: ["6"],
  pin7: ["7"],
  pin8: ["8"],
  pin9: ["9"],
  pin10: ["10"],
} as const

const unusedDisplayPins = [
  "pin1",
  "pin2",
  "pin4",
  "pin5",
  "pin6",
  "pin7",
  "pin9",
]

const displayFootprint = (
  <footprint>
    {[-5.08, -2.54, 0, 2.54, 5.08].map((x, index) => (
      <Fragment key={`lower-${index}`}>
        <platedhole
          portHints={[`pin${index + 1}`]}
          shape="circle"
          pcbX={x}
          pcbY={-3.8735}
          outerDiameter="1.524mm"
          holeDiameter="0.762mm"
        />
      </Fragment>
    ))}
    {[5.08, 2.54, 0, -2.54, -5.08].map((x, index) => (
      <Fragment key={`upper-${index}`}>
        <platedhole
          portHints={[`pin${index + 6}`]}
          shape="circle"
          pcbX={x}
          pcbY={3.7465}
          outerDiameter="1.524mm"
          holeDiameter="0.762mm"
        />
      </Fragment>
    ))}
    <courtyardoutline
      outline={[
        { x: -6.854, y: -5.3427 },
        { x: 6.854, y: -5.3427 },
        { x: 6.854, y: 5.2665 },
        { x: -6.854, y: 5.2665 },
        { x: -6.854, y: -5.3427 },
      ]}
    />
  </footprint>
)

const batteryHolderFootprint = (
  <footprint>
    <smtpad
      portHints={["pin1"]}
      pcbX={-8.599932}
      pcbY={0}
      width="4.5mm"
      height="2.3mm"
      shape="rect"
    />
    <smtpad
      portHints={["pin2"]}
      pcbX={8.599932}
      pcbY={0}
      width="4.5mm"
      height="2.3mm"
      shape="rect"
    />
    <courtyardoutline
      outline={[
        { x: -11.104944, y: -7.7176 },
        { x: 11.086656, y: -7.7176 },
        { x: 11.086656, y: 7.6922 },
        { x: -11.104944, y: 7.6922 },
        { x: -11.104944, y: -7.7176 },
      ]}
    />
  </footprint>
)

function Display({
  name,
  pcbX,
  segmentNet,
}: {
  name: string
  pcbX: number
  segmentNet: string
}) {
  return (
    <chip
      name={name}
      pinLabels={displayPinLabels}
      footprint={displayFootprint}
      pcbX={pcbX}
      pcbY={0}
      pcbRotation="270deg"
      noConnect={unusedDisplayPins}
      connections={{
        pin3: "net.GND",
        pin8: "net.GND",
        pin10: segmentNet,
      }}
    />
  )
}

test("repro: bottom-side holder covering through-hole display pins reports placement issues", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })

  circuit.add(
    <board width="40mm" height="30mm">
      <Display name="DS_LEFT" pcbX={-5.5} segmentNet="net.LEFT_SEG_A" />
      <Display name="DS_RIGHT" pcbX={9.5} segmentNet="net.RIGHT_SEG_A" />

      <resistor
        name="R_LEFT"
        resistance="1kohm"
        footprint="0603"
        pcbX={-13}
        pcbY={10}
        connections={{ pin1: "net.VBAT", pin2: "net.LEFT_SEG_A" }}
      />
      <resistor
        name="R_RIGHT"
        resistance="1kohm"
        footprint="0603"
        pcbX={13}
        pcbY={10}
        connections={{ pin1: "net.VBAT", pin2: "net.RIGHT_SEG_A" }}
      />

      <chip
        name="BT_HOLDER"
        layer="bottom"
        pcbX={0}
        pcbY={0}
        pcbRotation="90deg"
        pinLabels={{ pin1: ["1"], pin2: ["2"] }}
        footprint={batteryHolderFootprint}
        connections={{ pin1: "net.VBAT", pin2: "net.GND" }}
      />
    </board>,
  )

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const placementIssues = await runAllPlacementChecks(circuitJson)

  const displayPlatedHoles = circuitJson.filter(
    (element) => element.type === "pcb_plated_hole",
  )
  const routedConnections = circuitJson.filter(
    (element) => element.type === "pcb_trace",
  )
  const batterySource = circuitJson.find(
    (element) =>
      element.type === "source_component" && element.name === "BT_HOLDER",
  )
  if (batterySource?.type !== "source_component") {
    throw new Error("Expected the battery holder source component")
  }

  const batteryComponent = circuitJson.find(
    (element) =>
      element.type === "pcb_component" &&
      element.source_component_id === batterySource.source_component_id,
  )
  if (batteryComponent?.type !== "pcb_component") {
    throw new Error("Expected the battery holder PCB component")
  }

  const batteryCourtyard = circuitJson.find(
    (element) =>
      element.type === "pcb_courtyard_outline" &&
      element.pcb_component_id === batteryComponent.pcb_component_id,
  )

  if (batteryCourtyard?.type !== "pcb_courtyard_outline") {
    throw new Error("Expected the battery holder courtyard")
  }

  const displayPinsInsideHolderCourtyard = displayPlatedHoles.filter((hole) =>
    isPointInsidePolygon({ x: hole.x, y: hole.y }, batteryCourtyard.outline),
  )

  expect(displayPlatedHoles).toHaveLength(20)
  expect(displayPinsInsideHolderCourtyard).toHaveLength(10)
  expect(routedConnections.length).toBeGreaterThanOrEqual(6)

  const platedHoleCourtyardIssues = placementIssues.filter(
    (issue): issue is PcbFootprintOverlapError =>
      issue.type === "pcb_footprint_overlap_error" &&
      "pcb_plated_hole_ids" in issue &&
      issue.pcb_plated_hole_ids?.length === 1 &&
      issue.message.includes("pcb_courtyard_outline"),
  )

  expect(platedHoleCourtyardIssues).toHaveLength(10)
  expect(
    platedHoleCourtyardIssues.every((issue) =>
      issue.pcb_plated_hole_ids?.some((id) =>
        displayPinsInsideHolderCourtyard.some(
          (hole) => hole.pcb_plated_hole_id === id,
        ),
      ),
    ),
  ).toBe(true)

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...placementIssues], {
      showCourtyards: true,
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
