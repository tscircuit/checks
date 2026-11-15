import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"
import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkTestPointAccessibility } from "lib/check-testpoint-accessibility"
import { runAllPlacementChecks } from "lib/run-all-checks"
import type { AnyCircuitElement, PcbComponent } from "circuit-json"

const componentWithCourtyard = (
  <chip
    name="U1"
    pcbX={0}
    pcbY={0}
    footprint={
      <footprint>
        <smtpad
          portHints={["pin1"]}
          shape="rect"
          pcbX={0}
          pcbY={0}
          width="1mm"
          height="1mm"
        />
        <courtyardrect width="6mm" height="4mm" />
      </footprint>
    }
    pinLabels={{ 1: ["A"] }}
  />
)

test("reports a test point inside another component's courtyard", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board width="20mm" height="20mm" routingDisabled>
      {componentWithCourtyard}
      <testpoint
        name="TP1"
        footprintVariant="pad"
        padDiameter="1.2mm"
        pcbX={1}
        pcbY={0}
      />
    </board>,
  )

  await circuit.renderUntilSettled()
  const circuitJson = normalizeFixtureSourcePorts(circuit.getCircuitJson())
  const errors = checkTestPointAccessibility(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_placement_error",
    error_type: "pcb_placement_error",
    message:
      "Test point TP1 is not accessible because it is inside the courtyard of U1",
  })
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showCourtyards: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)

  expect(
    (await runAllPlacementChecks(circuitJson)).some(
      (result) => result.message === errors[0].message,
    ),
  ).toBe(true)
})

test("allows a test point outside component courtyards", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board width="20mm" height="20mm" routingDisabled>
      {componentWithCourtyard}
      <testpoint
        name="TP1"
        footprintVariant="pad"
        padDiameter="1.2mm"
        pcbX={4}
        pcbY={0}
      />
    </board>,
  )

  await circuit.renderUntilSettled()

  expect(
    checkTestPointAccessibility(
      normalizeFixtureSourcePorts(circuit.getCircuitJson()),
    ),
  ).toHaveLength(0)
})

test("allows a test point on the opposite PCB side", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board width="20mm" height="20mm" routingDisabled>
      {componentWithCourtyard}
      <testpoint
        name="TP1"
        footprintVariant="pad"
        padDiameter="1.2mm"
        pcbX={1}
        pcbY={0}
        layer="bottom"
      />
    </board>,
  )

  await circuit.renderUntilSettled()

  expect(
    checkTestPointAccessibility(
      normalizeFixtureSourcePorts(circuit.getCircuitJson()),
    ),
  ).toHaveLength(0)
})

test.each([
  { name: "center", point: { x: 0, y: 0 }, layer: "top", blocked: true },
  {
    name: "rounded corner",
    point: { x: 2.9, y: 1.9 },
    layer: "top",
    blocked: false,
  },
  {
    name: "inside rounded end",
    point: { x: 2.5, y: 1.5 },
    layer: "top",
    blocked: true,
  },
  { name: "outside", point: { x: 4, y: 0 }, layer: "top", blocked: false },
  {
    name: "opposite side",
    point: { x: 0, y: 0 },
    layer: "bottom",
    blocked: false,
  },
] as const)("pill courtyard: $name", ({ point, layer, blocked }) => {
  const testPoint: PcbComponent = {
    type: "pcb_component",
    pcb_component_id: "test_point",
    source_component_id: "source_test_point",
    center: point,
    layer,
    rotation: 0,
    width: 1,
    height: 1,
    obstructs_within_bounds: true,
  }
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_component",
      source_component_id: "source_test_point",
      ftype: "simple_test_point",
      name: "TP1",
    },
    {
      type: "source_component",
      source_component_id: "source_chip",
      ftype: "simple_chip",
      name: "U1",
    },
    testPoint,
    {
      ...testPoint,
      pcb_component_id: "chip",
      source_component_id: "source_chip",
      center: { x: 0, y: 0 },
    },
    {
      type: "pcb_courtyard_pill",
      pcb_courtyard_pill_id: "courtyard",
      pcb_component_id: "chip",
      center: { x: 0, y: 0 },
      width: 6,
      height: 4,
      radius: 1,
      layer: "top",
    },
  ]

  const errors = checkTestPointAccessibility(circuitJson)
  expect(errors).toHaveLength(blocked ? 1 : 0)
  if (blocked) {
    expect(errors[0]?.message).toBe(
      "Test point TP1 is not accessible because it is inside the courtyard of U1",
    )
  }
})
