import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"
import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkTestPointAccessibility } from "lib/check-testpoint-accessibility"
import { runAllPlacementChecks } from "lib/run-all-checks"

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

test("ignores courtyards of components marked do_not_place", () => {
  expect(
    checkTestPointAccessibility([
      {
        type: "source_component",
        source_component_id: "src_u1",
        name: "J_DEBUG",
        ftype: "simple_chip",
      },
      {
        type: "source_component",
        source_component_id: "src_tp1",
        name: "TP1",
        ftype: "simple_test_point",
        footprint_variant: "pad",
      },
      {
        type: "pcb_component",
        pcb_component_id: "pcb_u1",
        source_component_id: "src_u1",
        center: { x: 0, y: 0 },
        width: 6,
        height: 4,
        layer: "top",
        rotation: 0,
        obstructs_within_bounds: true,
        do_not_place: true,
      },
      {
        type: "pcb_courtyard_rect",
        pcb_courtyard_rect_id: "cy_u1",
        pcb_component_id: "pcb_u1",
        center: { x: 0, y: 0 },
        width: 6,
        height: 4,
        layer: "top",
      },
      {
        type: "pcb_component",
        pcb_component_id: "pcb_tp1",
        source_component_id: "src_tp1",
        center: { x: 1, y: 0 },
        width: 1.2,
        height: 1.2,
        layer: "top",
        rotation: 0,
        obstructs_within_bounds: false,
      },
    ]),
  ).toHaveLength(0)
})

test("ignores test points marked do_not_place", () => {
  expect(
    checkTestPointAccessibility([
      {
        type: "source_component",
        source_component_id: "src_u1",
        name: "U1",
        ftype: "simple_chip",
      },
      {
        type: "source_component",
        source_component_id: "src_tp1",
        name: "TP1",
        ftype: "simple_test_point",
        footprint_variant: "pad",
      },
      {
        type: "pcb_component",
        pcb_component_id: "pcb_u1",
        source_component_id: "src_u1",
        center: { x: 0, y: 0 },
        width: 6,
        height: 4,
        layer: "top",
        rotation: 0,
        obstructs_within_bounds: true,
      },
      {
        type: "pcb_courtyard_rect",
        pcb_courtyard_rect_id: "cy_u1",
        pcb_component_id: "pcb_u1",
        center: { x: 0, y: 0 },
        width: 6,
        height: 4,
        layer: "top",
      },
      {
        type: "pcb_component",
        pcb_component_id: "pcb_tp1",
        source_component_id: "src_tp1",
        center: { x: 1, y: 0 },
        width: 1.2,
        height: 1.2,
        layer: "top",
        rotation: 0,
        obstructs_within_bounds: false,
        do_not_place: true,
      },
    ]),
  ).toHaveLength(0)
})
