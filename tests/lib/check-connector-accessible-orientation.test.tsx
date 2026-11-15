import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkConnectorAccessibleOrientation } from "lib/check-connector-accessible-orientation"
import type { AnyCircuitElement } from "circuit-json"

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
  expect(warnings[0].message).toContain("is inferred to face")
  expect(warnings[0].message).toContain(
    "no explicit footprint insertionDirection",
  )
  expect(warnings[0].message).toContain(
    '<footprint insertionDirection="from_above">',
  )
  expect(warnings[0]).toMatchObject({
    type: "pcb_connector_not_in_accessible_orientation_warning",
    facing_direction: "y-",
    recommended_facing_direction: "x-",
  })

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
  expect(warnings[0].message).not.toContain("inferred")
  expect(warnings[0].message).not.toContain("no explicit")
})

test("connector orientation check skips from_above insertion direction", () => {
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
      insertion_direction: "from_above",
      cable_insertion_center: { x: -14, y: -2 },
      obstructs_within_bounds: true,
    },
  ]

  const warnings = checkConnectorAccessibleOrientation(circuitJson)
  expect(warnings).toHaveLength(0)
})

test("pin headers ignore inferred side entry but retain explicit right-angle warnings", () => {
  const board: AnyCircuitElement = {
    type: "pcb_board",
    pcb_board_id: "board",
    center: { x: 0, y: 0 },
    width: 30,
    height: 20,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
  }
  const header: AnyCircuitElement = {
    type: "source_component",
    source_component_id: "header",
    name: "J1",
    ftype: "simple_pin_header",
    pin_count: 2,
    gender: "male",
  }
  const pcbHeader: Extract<AnyCircuitElement, { type: "pcb_component" }> = {
    type: "pcb_component",
    pcb_component_id: "pcb_header",
    source_component_id: "header",
    center: { x: -14, y: 0 },
    cable_insertion_center: { x: -12, y: 0 },
    width: 4,
    height: 4,
    layer: "top",
    rotation: 0,
    obstructs_within_bounds: true,
  }
  expect(
    checkConnectorAccessibleOrientation([board, header, pcbHeader]),
  ).toHaveLength(0)
  for (const insertion_direction of [
    "from_above",
    "from_below",
    "from_left",
  ] as const) {
    expect(
      checkConnectorAccessibleOrientation([
        board,
        header,
        { ...pcbHeader, insertion_direction },
      ]),
    ).toHaveLength(0)
  }
  const warnings = checkConnectorAccessibleOrientation([
    board,
    header,
    { ...pcbHeader, insertion_direction: "from_right" },
  ])
  expect(warnings).toHaveLength(1)
})

test("skips connectors marked accessible_from_board_edge: false while still checking external connectors", () => {
  const board: AnyCircuitElement = {
    type: "pcb_board",
    pcb_board_id: "board",
    center: { x: 0, y: 0 },
    width: 40,
    height: 30,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
  }
  const internalSource: AnyCircuitElement = {
    type: "source_component",
    source_component_id: "src_internal",
    ftype: "simple_connector",
    name: "J_DISP",
  }
  const internalPcb = {
    type: "pcb_component" as const,
    pcb_component_id: "pcb_internal",
    source_component_id: "src_internal",
    center: { x: 0, y: -12 },
    width: 10,
    height: 3,
    layer: "top" as const,
    rotation: 0,
    insertion_direction: "from_left" as const,
    accessible_from_board_edge: false,
    obstructs_within_bounds: true,
  }
  const externalSource: AnyCircuitElement = {
    type: "source_component",
    source_component_id: "src_usb",
    ftype: "simple_connector",
    name: "J_USB",
    standard: "usb_c",
  }
  const externalPcb: Extract<AnyCircuitElement, { type: "pcb_component" }> = {
    type: "pcb_component",
    pcb_component_id: "pcb_usb",
    source_component_id: "src_usb",
    center: { x: 0, y: -12 },
    width: 9,
    height: 7,
    layer: "top",
    rotation: 0,
    insertion_direction: "from_left",
    obstructs_within_bounds: true,
  }

  const warnings = checkConnectorAccessibleOrientation([
    board,
    internalSource,
    internalPcb as AnyCircuitElement,
    externalSource,
    externalPcb,
  ])

  expect(warnings).toHaveLength(1)
  expect(warnings[0]?.pcb_component_id).toBe("pcb_usb")
  expect(warnings[0]).toMatchObject({
    facing_direction: "x-",
    recommended_facing_direction: "y-",
  })
})

test("skips internal FPC/FFC board-to-flex sockets such as FH34SRJ and KiCad FFC-FPC footprints", () => {
  const board: AnyCircuitElement = {
    type: "pcb_board",
    pcb_board_id: "board",
    center: { x: 0, y: 0 },
    width: 40,
    height: 30,
    thickness: 1.0,
    num_layers: 4,
    material: "fr4",
  }
  const fh34Source: AnyCircuitElement = {
    type: "source_component",
    source_component_id: "src_fh34",
    ftype: "simple_connector",
    name: "J_FLEX1",
    manufacturer_part_number: "FH34SRJ-34S-0.5SH(50)",
  }
  const fh34Pcb: Extract<AnyCircuitElement, { type: "pcb_component" }> = {
    type: "pcb_component",
    pcb_component_id: "pcb_fh34",
    source_component_id: "src_fh34",
    center: { x: 0, y: -12 },
    width: 18.5,
    height: 3.8,
    layer: "top",
    rotation: 0,
    insertion_direction: "from_left",
    obstructs_within_bounds: true,
  }
  const kicadFpcSource: AnyCircuitElement = {
    type: "source_component",
    source_component_id: "src_kicad_fpc",
    ftype: "simple_connector",
    name: "J_FLEX2",
  }
  const kicadFpcPcb: Extract<AnyCircuitElement, { type: "pcb_component" }> = {
    type: "pcb_component",
    pcb_component_id: "pcb_kicad_fpc",
    source_component_id: "src_kicad_fpc",
    center: { x: 2, y: -12 },
    width: 12,
    height: 4,
    layer: "top",
    rotation: 0,
    insertion_direction: "from_left",
    metadata: {
      kicad_footprint: {
        footprintName:
          "Connector_FFC-FPC:Hirose_FH12-24S-0.5SH_1x24-1MP_P0.50mm_Horizontal",
      },
    },
    obstructs_within_bounds: true,
  }

  expect(
    checkConnectorAccessibleOrientation([
      board,
      fh34Source,
      fh34Pcb,
      kicadFpcSource,
      kicadFpcPcb,
    ]),
  ).toHaveLength(0)
})
