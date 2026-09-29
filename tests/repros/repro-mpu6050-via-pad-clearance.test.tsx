import { beforeAll, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkViaPadClearance } from "../../lib/check-via-pad-clearance"

// Render the original board source so the router creates the via under test.
/** Compact 3.3 V MPU-6050 breakout. J1: 3V3, GND, SDA, SCL, INT, AD0. */
const Mpu6050Board = () => (
  <board
    width="11mm"
    height="12mm"
    thickness="1.6mm"
    minTraceWidth="0.15mm"
    nominalTraceWidth="0.15mm"
    minViaHoleDiameter="0.3mm"
    minViaPadDiameter="0.6mm"
  >
    <copperpour
      name="GND_PLANE"
      layer="bottom"
      connectsTo="net.GND"
      clearance="0.2mm"
      boardEdgeMargin="0.25mm"
    />
    <chip
      name="U1"
      manufacturerPartNumber="MPU-6050"
      footprint={
        <footprint>
          <smtpad
            shape="rect"
            portHints={["1"]}
            pcbX={-2.1}
            pcbY={1.25}
            width={0.65}
            height={0.3}
          />
          <smtpad
            shape="rect"
            portHints={["2"]}
            pcbX={-2.1}
            pcbY={0.75}
            width={0.65}
            height={0.3}
          />
          <smtpad
            shape="rect"
            portHints={["3"]}
            pcbX={-2.1}
            pcbY={0.25}
            width={0.65}
            height={0.3}
          />
          <smtpad
            shape="rect"
            portHints={["4"]}
            pcbX={-2.1}
            pcbY={-0.25}
            width={0.65}
            height={0.3}
          />
          <smtpad
            shape="rect"
            portHints={["5"]}
            pcbX={-2.1}
            pcbY={-0.75}
            width={0.65}
            height={0.3}
          />
          <smtpad
            shape="rect"
            portHints={["6"]}
            pcbX={-2.1}
            pcbY={-1.25}
            width={0.65}
            height={0.3}
          />
          <smtpad
            shape="rect"
            portHints={["7"]}
            pcbX={-1.25}
            pcbY={-2.1}
            width={0.3}
            height={0.65}
          />
          <smtpad
            shape="rect"
            portHints={["8"]}
            pcbX={-0.75}
            pcbY={-2.1}
            width={0.3}
            height={0.65}
          />
          <smtpad
            shape="rect"
            portHints={["9"]}
            pcbX={-0.25}
            pcbY={-2.1}
            width={0.3}
            height={0.65}
          />
          <smtpad
            shape="rect"
            portHints={["10"]}
            pcbX={0.25}
            pcbY={-2.1}
            width={0.3}
            height={0.65}
          />
          <smtpad
            shape="rect"
            portHints={["11"]}
            pcbX={0.75}
            pcbY={-2.1}
            width={0.3}
            height={0.65}
          />
          <smtpad
            shape="rect"
            portHints={["12"]}
            pcbX={1.25}
            pcbY={-2.1}
            width={0.3}
            height={0.65}
          />
          <smtpad
            shape="rect"
            portHints={["13"]}
            pcbX={2.1}
            pcbY={-1.25}
            width={0.65}
            height={0.3}
          />
          <smtpad
            shape="rect"
            portHints={["14"]}
            pcbX={2.1}
            pcbY={-0.75}
            width={0.65}
            height={0.3}
          />
          <smtpad
            shape="rect"
            portHints={["15"]}
            pcbX={2.1}
            pcbY={-0.25}
            width={0.65}
            height={0.3}
          />
          <smtpad
            shape="rect"
            portHints={["16"]}
            pcbX={2.1}
            pcbY={0.25}
            width={0.65}
            height={0.3}
          />
          <smtpad
            shape="rect"
            portHints={["17"]}
            pcbX={2.1}
            pcbY={0.75}
            width={0.65}
            height={0.3}
          />
          <smtpad
            shape="rect"
            portHints={["18"]}
            pcbX={2.1}
            pcbY={1.25}
            width={0.65}
            height={0.3}
          />
          <smtpad
            shape="rect"
            portHints={["19"]}
            pcbX={1.25}
            pcbY={2.1}
            width={0.3}
            height={0.65}
          />
          <smtpad
            shape="rect"
            portHints={["20"]}
            pcbX={0.75}
            pcbY={2.1}
            width={0.3}
            height={0.65}
          />
          <smtpad
            shape="rect"
            portHints={["21"]}
            pcbX={0.25}
            pcbY={2.1}
            width={0.3}
            height={0.65}
          />
          <smtpad
            shape="rect"
            portHints={["22"]}
            pcbX={-0.25}
            pcbY={2.1}
            width={0.3}
            height={0.65}
          />
          <smtpad
            shape="rect"
            portHints={["23"]}
            pcbX={-0.75}
            pcbY={2.1}
            width={0.3}
            height={0.65}
          />
          <smtpad
            shape="rect"
            portHints={["24"]}
            pcbX={-1.25}
            pcbY={2.1}
            width={0.3}
            height={0.65}
          />
        </footprint>
      }
      pcbX={0}
      pcbY={-0.35}
      pinLabels={{
        pin1: "CLKIN",
        pin2: "NC2",
        pin3: "NC3",
        pin4: "NC4",
        pin5: "NC5",
        pin6: "AUX_DA",
        pin7: "AUX_CL",
        pin8: "VLOGIC",
        pin9: "AD0",
        pin10: "REGOUT",
        pin11: "FSYNC",
        pin12: "INT",
        pin13: "VDD",
        pin14: "NC14",
        pin15: "NC15",
        pin16: "NC16",
        pin17: "NC17",
        pin18: "GND",
        pin19: "RESV19",
        pin20: "CPOUT",
        pin21: "RESV21",
        pin22: "RESV22",
        pin23: "SCL",
        pin24: "SDA",
      }}
      noConnect={[
        "NC2",
        "NC3",
        "NC4",
        "NC5",
        "AUX_DA",
        "AUX_CL",
        "NC14",
        "NC15",
        "NC16",
        "NC17",
        "RESV19",
        "RESV21",
        "RESV22",
      ]}
      connections={{
        CLKIN: "net.GND",
        VLOGIC: "net.V3V3",
        AD0: "net.AD0",
        REGOUT: "net.REGOUT",
        FSYNC: "net.GND",
        INT: "net.INT",
        VDD: "net.V3V3",
        GND: "net.GND",
        CPOUT: "net.CPOUT",
        SCL: "net.SCL",
        SDA: "net.SDA",
      }}
    />

    <pinheader
      name="J1"
      pinCount={6}
      pitch="1.27mm"
      holeDiameter="0.7mm"
      platedDiameter="1.1mm"
      gender="unpopulated"
      pcbX={0}
      pcbY={4.3}
      pinLabels={{
        pin1: "VCC",
        pin2: "GND",
        pin3: "SDA",
        pin4: "SCL",
        pin5: "INT",
        pin6: "AD0",
      }}
      connections={{
        VCC: "net.V3V3",
        GND: "net.GND",
        SDA: "net.SDA",
        SCL: "net.SCL",
        INT: "net.INT",
        AD0: "net.AD0",
      }}
    />

    <capacitor
      name="C1"
      capacitance="100nF"
      footprint="0402"
      pcbX={3.6}
      pcbY={-1.2}
      connections={{ pin1: "net.V3V3", pin2: "net.GND" }}
    />
    <capacitor
      name="C2"
      capacitance="10nF"
      footprint="0402"
      pcbX={-3.6}
      pcbY={-1.2}
      connections={{ pin1: "net.V3V3", pin2: "net.GND" }}
    />
    <capacitor
      name="C3"
      capacitance="100nF"
      footprint="0402"
      pcbX={-2.1}
      pcbY={-3.7}
      connections={{ pin1: "net.REGOUT", pin2: "net.GND" }}
    />
    <capacitor
      name="C4"
      capacitance="2.2nF"
      footprint="0402"
      pcbX={2.1}
      pcbY={-3.7}
      connections={{ pin1: "net.CPOUT", pin2: "net.GND" }}
    />

    <resistor
      name="R1"
      resistance="4.7k"
      footprint="0402"
      pcbX={-4}
      pcbY={1.7}
      connections={{ pin1: "net.V3V3", pin2: "net.SDA" }}
    />
    <resistor
      name="R2"
      resistance="4.7k"
      footprint="0402"
      pcbX={4}
      pcbY={1.7}
      connections={{ pin1: "net.V3V3", pin2: "net.SCL" }}
    />
    <resistor
      name="R3"
      resistance="10k"
      footprint="0402"
      pcbX={0}
      pcbY={-4.2}
      connections={{ pin1: "net.AD0", pin2: "net.GND" }}
    />
  </board>
)

let circuitJson: AnyCircuitElement[] = []
beforeAll(async () => {
  const circuit = new Circuit()
  circuit.add(Mpu6050Board())
  await circuit.renderUntilSettled()
  circuitJson = circuit.getCircuitJson()
}, 30_000)

const minClearance = 0.1

function findCircuitElement<Type extends AnyCircuitElement["type"]>(
  type: Type,
  predicate: (element: Extract<AnyCircuitElement, { type: Type }>) => boolean,
) {
  return circuitJson
    .filter(
      (element): element is Extract<AnyCircuitElement, { type: Type }> =>
        element.type === type,
    )
    .find(predicate)
}

function getViaAndC3GndPad() {
  const board = findCircuitElement("pcb_board", () => true)
  const c3 = findCircuitElement(
    "source_component",
    (element) => element.name === "C3",
  )
  const c3Pin2 = findCircuitElement(
    "source_port",
    (element) =>
      element.source_component_id === c3?.source_component_id &&
      element.name === "pin2",
  )
  const c3PcbPort = findCircuitElement(
    "pcb_port",
    (element) => element.source_port_id === c3Pin2?.source_port_id,
  )
  const c3GndPad = findCircuitElement(
    "pcb_smtpad",
    (element) => element.pcb_port_id === c3PcbPort?.pcb_port_id,
  )
  const via = findCircuitElement(
    "pcb_via",
    (element) => element.pcb_via_id === "pcb_via_8",
  )
  const gnd = findCircuitElement(
    "source_net",
    (element) => element.name === "GND",
  )
  const v3v3 = findCircuitElement(
    "source_net",
    (element) => element.name === "V3V3",
  )

  if (
    !board ||
    !c3 ||
    !c3Pin2 ||
    !c3PcbPort ||
    !c3GndPad ||
    !via ||
    !gnd ||
    !v3v3
  ) {
    throw new Error("The MPU-6050 Circuit JSON fixture is incomplete")
  }
  if (c3GndPad.shape !== "rect") {
    throw new Error("Expected C3 pin 2 to be a rectangular pad")
  }

  return { board, c3, c3Pin2, c3PcbPort, c3GndPad, via, gnd, v3v3 }
}

// The chip pads remain in the visual snapshot. The clearance assertion uses
// only the C3 pair so another nearby chip pad cannot satisfy its expectation.
const getFocusedCircuitJson = (): AnyCircuitElement[] =>
  Object.values(getViaAndC3GndPad())

test("MPU-6050 fixture has a V3V3 via within 0.1 mm of C3 GND", () => {
  const { board, c3Pin2, c3GndPad, via, gnd, v3v3 } = getViaAndC3GndPad()

  expect(board.min_pad_edge_to_pad_edge_clearance).toBe(minClearance)
  expect(c3Pin2.subcircuit_connectivity_map_key).toBe(
    gnd.subcircuit_connectivity_map_key,
  )
  expect(via.subcircuit_connectivity_map_key).toBe(
    v3v3.subcircuit_connectivity_map_key,
  )
  expect(gnd.subcircuit_connectivity_map_key).not.toBe(
    v3v3.subcircuit_connectivity_map_key,
  )
  expect(via.layers).toContain(c3GndPad.layer)

  // Circle-to-axis-aligned-rectangle gap, calculated independently of the
  // checker's getPadToPadGap helper.
  const dx = Math.max(Math.abs(via.x - c3GndPad.x) - c3GndPad.width / 2, 0)
  const dy = Math.max(Math.abs(via.y - c3GndPad.y) - c3GndPad.height / 2, 0)
  const gap = Math.hypot(dx, dy) - via.outer_diameter / 2
  expect(gap).toBeCloseTo(0.0972614961, 6)
  expect(gap).toBeLessThan(minClearance)

  // A normal test checks that the checker runs and that the geometry snapshot
  // renders. A render failure cannot satisfy the expected-failure test below.
  const errors = checkViaPadClearance(getFocusedCircuitJson(), { minClearance })
  expect(errors.length).toBeLessThanOrEqual(1)
  for (const error of errors) {
    expect(error.pcb_pad_ids).toEqual([via.pcb_via_id, c3GndPad.pcb_smtpad_id])
  }
  expect(
    checkViaPadClearance(getFocusedCircuitJson(), {
      minClearance: minClearance + 0.005,
    }).map((error) => error.pcb_pad_ids),
  ).toEqual([[via.pcb_via_id, c3GndPad.pcb_smtpad_id]])
  const annotatedCircuitJson: AnyCircuitElement[] = [
    ...circuitJson,
    {
      type: "pcb_note_text",
      pcb_note_text_id: "mpu6050_clearance_note",
      text: `V3V3 via to C3 pin 2: ${gap.toFixed(4)}mm < ${minClearance}mm`,
      anchor_position: { x: 0, y: -5.5 },
      anchor_alignment: "center",
      font: "tscircuit2024",
      font_size: 0.18,
      layer: "top",
      color: "#fbbf24",
    },
  ]
  expect(convertCircuitJsonToPcbSvg(annotatedCircuitJson)).toMatchSvgSnapshot(
    import.meta.path,
  )
})

test.failing("MPU-6050 via-to-pad clearance should be reported", () => {
  const { via, c3GndPad } = getViaAndC3GndPad()
  const errors = checkViaPadClearance(getFocusedCircuitJson(), { minClearance })
  expect(errors).toHaveLength(1)
  expect(errors[0]?.pcb_pad_ids).toEqual([
    via.pcb_via_id,
    c3GndPad.pcb_smtpad_id,
  ])
})
