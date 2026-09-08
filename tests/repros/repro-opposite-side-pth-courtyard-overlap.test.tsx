import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { runAllPlacementChecks } from "../.."

const displayFootprint = (
  <footprint>
    {[-5.08, -2.54, 0, 2.54, 5.08].map((x, index) => (
      <platedhole
        key={`lower-${index}`}
        portHints={[`pin${index + 1}`]}
        pcbX={x}
        pcbY={-3.81}
        outerDiameter="1.524mm"
        holeDiameter="0.762mm"
      />
    ))}
    {[5.08, 2.54, 0, -2.54, -5.08].map((x, index) => (
      <platedhole
        key={`upper-${index}`}
        portHints={[`pin${index + 6}`]}
        pcbX={x}
        pcbY={3.81}
        outerDiameter="1.524mm"
        holeDiameter="0.762mm"
      />
    ))}
    <courtyardrect width="13.7mm" height="10.7mm" />
  </footprint>
)

const batteryHolderFootprint = (
  <footprint>
    <smtpad
      portHints={["pin1"]}
      pcbX="-8.6mm"
      width="4.5mm"
      height="2.3mm"
      shape="rect"
    />
    <smtpad
      portHints={["pin2"]}
      pcbX="8.6mm"
      width="4.5mm"
      height="2.3mm"
      shape="rect"
    />
    <courtyardrect width="22.2mm" height="15.4mm" />
  </footprint>
)

test("repro: opposite-side battery holder covers through-hole display pins without a placement issue", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })

  circuit.add(
    <board width="30mm" height="24mm">
      <chip
        name="DS1"
        pcbX={0}
        pcbY={0}
        pinLabels={{
          1: "1",
          2: "2",
          3: "GND1",
          4: "4",
          5: "5",
          6: "6",
          7: "7",
          8: "GND2",
          9: "9",
          10: "SEG_A",
        }}
        footprint={displayFootprint}
        noConnect={["pin1", "pin2", "pin4", "pin5", "pin6", "pin7", "pin9"]}
        connections={{
          GND1: "net.GND",
          GND2: "net.GND",
          SEG_A: "R1.pin2",
        }}
      />

      <chip
        name="BT1"
        layer="bottom"
        pcbX={0}
        pcbY={0}
        pinLabels={{ 1: "VBAT", 2: "GND" }}
        footprint={batteryHolderFootprint}
        connections={{ VBAT: "R1.pin1", GND: "net.GND" }}
      />

      <resistor
        name="R1"
        resistance="1kohm"
        footprint="0603"
        pcbX={0}
        pcbY={9.5}
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

  expect(displayPlatedHoles).toHaveLength(10)
  expect(routedConnections.length).toBeGreaterThanOrEqual(3)

  // Current bug: no issue is reported even though the through-hole pins extend
  // into the battery holder's assembly space on the opposite side of the PCB.
  expect(placementIssues).toHaveLength(0)

  expect(
    convertCircuitJsonToPcbSvg(circuitJson, {
      showCourtyards: true,
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
