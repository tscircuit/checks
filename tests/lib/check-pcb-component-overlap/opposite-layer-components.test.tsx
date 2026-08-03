import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { runAllPlacementChecks } from "lib/run-all-checks"

const footprint = (
  <footprint>
    <smtpad
      portHints={["pin1"]}
      shape="rect"
      pcbX="0.5mm"
      pcbY={0}
      width="2mm"
      height="2mm"
    />
    <courtyardrect width="4mm" height="4mm" />
  </footprint>
)

test("allows SMT components to share coordinates on opposite layers", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board width="10mm" height="10mm" routingDisabled>
      <chip
        name="U1"
        footprint={footprint}
        pinLabels={{ 1: ["A"] }}
        layer="top"
        pcbX={0}
        pcbY={0}
      />
      <chip
        name="U2"
        footprint={footprint}
        pinLabels={{ 1: ["A"] }}
        layer="bottom"
        pcbX={0}
        pcbY={0}
      />
    </board>,
  )

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const errors = await runAllPlacementChecks(circuitJson)

  expect(errors).toEqual([])
  expect(
    convertCircuitJsonToPcbSvg(circuitJson, {
      shouldDrawErrors: true,
      showCourtyards: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
