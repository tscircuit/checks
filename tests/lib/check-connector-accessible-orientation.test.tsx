import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkConnectorAccessibleOrientation } from "lib/check-connector-accessible-orientation"

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
