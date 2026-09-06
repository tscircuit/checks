import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkConnectorAccessibleOrientation } from "lib/check-connector-accessible-orientation"
import type { AnyCircuitElement, PcbComponent } from "circuit-json"

const TYPE_C_6P_FOOTPRINT = (
  <footprint>
    <platedhole
      portHints={["pin7"]}
      pcbX="4.319904999999949mm"
      pcbY="-2.300014400000009mm"
      holeWidth="0.5999987999999999mm"
      holeHeight="1.3999972mm"
      outerWidth="1.0999978mm"
      outerHeight="1.8999962mm"
      shape="pill"
    />
    <platedhole
      portHints={["pin8"]}
      pcbX="-4.3199050000000625mm"
      pcbY="-2.300014400000009mm"
      holeWidth="0.5999987999999999mm"
      holeHeight="1.3999972mm"
      outerWidth="1.0999978mm"
      outerHeight="1.8999962mm"
      shape="pill"
    />
    <platedhole
      portHints={["pin9"]}
      pcbX="4.319904999999949mm"
      pcbY="1.5000795999999355mm"
      holeWidth="0.5999987999999999mm"
      holeHeight="1.3999972mm"
      outerWidth="1.0999978mm"
      outerHeight="1.8999962mm"
      shape="pill"
    />
    <platedhole
      portHints={["pin10"]}
      pcbX="-4.3199050000000625mm"
      pcbY="1.5000795999999355mm"
      holeWidth="0.5999987999999999mm"
      holeHeight="1.3999972mm"
      outerWidth="1.0999978mm"
      outerHeight="1.8999962mm"
      shape="pill"
    />
    <smtpad
      portHints={["pin11"]}
      pcbX="-2.6998930000000883mm"
      pcbY="1.7500155999998697mm"
      width="0.7999983999999999mm"
      height="1.1999975999999999mm"
      shape="rect"
    />
    <smtpad
      portHints={["pin12"]}
      pcbX="-1.4999970000001213mm"
      pcbY="1.7500155999998697mm"
      width="0.6999986mm"
      height="1.1999975999999999mm"
      shape="rect"
    />
    <smtpad
      portHints={["pin13"]}
      pcbX="-0.4999990000001162mm"
      pcbY="1.7500155999998697mm"
      width="0.6999986mm"
      height="1.1999975999999999mm"
      shape="rect"
    />
    <smtpad
      portHints={["pin14"]}
      pcbX="0.4999990000000025mm"
      pcbY="1.7500155999998697mm"
      width="0.6999986mm"
      height="1.1999975999999999mm"
      shape="rect"
    />
    <smtpad
      portHints={["pin15"]}
      pcbX="1.4999970000000076mm"
      pcbY="1.7500155999998697mm"
      width="0.6999986mm"
      height="1.1999975999999999mm"
      shape="rect"
    />
    <smtpad
      portHints={["pin16"]}
      pcbX="2.6998929999999746mm"
      pcbY="1.7500155999998697mm"
      width="0.7999983999999999mm"
      height="1.1999975999999999mm"
      shape="rect"
    />
  </footprint>
)

test("connector orientation warning is emitted when cable insertion points inward", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width="30mm" height="20mm" routingDisabled>
      <connector
        name="J1"
        pcbX="-13mm"
        pcbY="0mm"
        footprint={TYPE_C_6P_FOOTPRINT}
        pinLabels={{ 1: ["A"], 2: ["B"] }}
      />
    </board>,
  )

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const warnings = checkConnectorAccessibleOrientation(circuitJson as any)

  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    type: "pcb_connector_not_in_accessible_orientation_warning",
    facing_direction: "y-",
    recommended_facing_direction: "x-",
  })

  expect(warnings[0]?.message).toStartWith("J1 faces y-")
  expect(warnings[0]?.message).toContain("inferred from cable_insertion_center")
  expect(warnings[0]?.message).toContain("adjust pcbRotation to face x-")
  expect(warnings[0]?.message).toContain('insertionDirection="from_above"')
  expect(warnings[0]?.message).toContain('or "from_below" on its <footprint>')
  expect(warnings[0]?.message).toContain(
    '"from_top" means y+, not above the board',
  )

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...warnings] as any, {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})

test("connector orientation check skips components without cable_insertion_center", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width="30mm" height="20mm" routingDisabled>
      <chip name="U1" pcbX="10mm" pcbY="0mm" pinLabels={{ 1: ["P1"] }} />
    </board>,
  )

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()

  const warnings = checkConnectorAccessibleOrientation(circuitJson as any)
  expect(warnings).toHaveLength(0)
})

test("connector orientation check uses insertion_direction when present", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "pcb_board_0",
      outline: [
        { x: -15, y: -10 },
        { x: 15, y: -10 },
        { x: 15, y: 10 },
        { x: -15, y: 10 },
      ],
      center: { x: 0, y: 0 },
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
    },
    {
      type: "source_component",
      source_component_id: "source_component_0",
      ftype: "simple_connector",
      name: "J1",
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_component_0",
      source_component_id: "source_component_0",
      center: { x: -14, y: 0 },
      width: 4,
      height: 4,
      layer: "top",
      rotation: 0,
      insertion_direction: "from_left",
      cable_insertion_center: { x: -14, y: -2 },
      obstructs_within_bounds: true,
    },
    {
      type: "source_component",
      source_component_id: "source_component_1",
      ftype: "simple_connector",
      name: "J2",
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_component_1",
      source_component_id: "source_component_1",
      center: { x: -14, y: 4 },
      width: 4,
      height: 4,
      layer: "top",
      rotation: 0,
      insertion_direction: "from_bottom",
      obstructs_within_bounds: true,
    },
  ]

  const warnings = checkConnectorAccessibleOrientation(circuitJson)

  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    type: "pcb_connector_not_in_accessible_orientation_warning",
    pcb_component_id: "pcb_component_1",
    facing_direction: "y-",
    recommended_facing_direction: "x-",
  })
  expect(warnings[0]?.message).toContain('insertion_direction="from_bottom"')
  expect(warnings[0]?.message).not.toContain("inferred")
})

function createConnectorCircuitJson(
  insertionDirection: PcbComponent["insertion_direction"],
): AnyCircuitElement[] {
  return [
    {
      type: "pcb_board",
      pcb_board_id: "pcb_board_0",
      outline: [
        { x: -15, y: -10 },
        { x: 15, y: -10 },
        { x: 15, y: 10 },
        { x: -15, y: 10 },
      ],
      center: { x: 0, y: 0 },
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
    },
    {
      type: "source_component",
      source_component_id: "source_component_0",
      ftype: "simple_connector",
      name: "J2_BATTERY",
    },
    {
      type: "pcb_component",
      pcb_component_id: "pcb_component_0",
      source_component_id: "source_component_0",
      center: { x: -14, y: 0 },
      width: 4,
      height: 4,
      layer: "top",
      rotation: 0,
      insertion_direction: insertionDirection,
      cable_insertion_center: { x: -14, y: -2 },
      obstructs_within_bounds: true,
    },
  ]
}

test.each(["from_above", "from_below"] as const)(
  "%s skips the edge-facing check despite a misleading XY cable insertion center",
  (insertionDirection) => {
    const circuitJson = createConnectorCircuitJson(insertionDirection)
    expect(checkConnectorAccessibleOrientation(circuitJson)).toHaveLength(0)

    // The same geometry without explicit metadata is inferred to face y-.
    const inferredWarnings = checkConnectorAccessibleOrientation(
      createConnectorCircuitJson(undefined),
    )
    expect(inferredWarnings).toHaveLength(1)
    expect(inferredWarnings[0]?.facing_direction).toBe("y-")
  },
)

test.each([
  ["from_left", "x-"],
  ["from_right", "x+"],
  ["from_top", "y+"],
  ["from_bottom", "y-"],
] as const)(
  "explicit %s takes precedence over inferred cable direction and faces %s",
  (insertionDirection, facingDirection) => {
    const warnings = checkConnectorAccessibleOrientation(
      createConnectorCircuitJson(insertionDirection),
    )
    if (facingDirection === "x-") {
      expect(warnings).toHaveLength(0)
    } else {
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toMatchObject({
        facing_direction: facingDirection,
        recommended_facing_direction: "x-",
      })
      expect(warnings[0]?.message).toContain(
        `insertion_direction="${insertionDirection}"`,
      )
      expect(warnings[0]?.message).not.toContain("inferred")
    }
  },
)

test("connector warnings name the source component and tolerate missing source metadata", () => {
  const circuitJson = createConnectorCircuitJson(undefined)
  expect(
    checkConnectorAccessibleOrientation(circuitJson)[0]?.message,
  ).toStartWith("J2_BATTERY faces y-")

  const withoutSource = circuitJson.filter(
    (el) => el.type !== "source_component",
  )
  expect(
    checkConnectorAccessibleOrientation(withoutSource)[0]?.message,
  ).toStartWith("component faces y-")
})
