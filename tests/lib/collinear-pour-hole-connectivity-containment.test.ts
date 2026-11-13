import { expect, test } from "bun:test"
import { getPourPolygon, getSmtPadPolygon } from "@tscircuit/circuit-json-util"
import {
  type AnyCircuitElement,
  type PcbCopperPour,
  type PcbSmtPad,
  any_circuit_element,
} from "circuit-json"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { getPourContactTester } from "lib/check-dangling-traces/pour-contact-index"
import { createCopperPolygonContactTester } from "lib/copper-pour-connectivity/create-copper-polygon-contact-tester"

const safePadX = -0.2499360000000003
const padY = 33.6450052
const padWidth = 0.2999994
const padHeight = 1.1500104

const ordinaryHole = [
  { x: -3, y: 31 },
  { x: 3, y: 31 },
  { x: 3, y: 36 },
  { x: -3, y: 36 },
]

const collinearHole = [
  { x: -3, y: 31 },
  { x: 3, y: 31 },
  { x: 3, y: 33.069999 },
  { x: 3, y: 33.070001 },
  { x: 3, y: 36 },
  { x: -3, y: 36 },
]

function createSameNetPourHoleCircuit({
  collinearVertices,
  padX = safePadX,
  hole = collinearVertices ? collinearHole : ordinaryHole,
}: {
  collinearVertices: boolean
  padX?: number
  hole?: { x: number; y: number }[]
}): AnyCircuitElement[] {
  return [
    {
      type: "pcb_board",
      pcb_board_id: "board",
      center: { x: 0, y: 32.5 },
      width: 22,
      height: 17,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
    },
    {
      type: "source_net",
      source_net_id: "ground",
      name: "GND",
      member_source_group_ids: [],
    },
    {
      type: "source_component",
      source_component_id: "usb",
      name: "J_USB",
      ftype: "simple_chip",
    },
    {
      type: "source_port",
      source_port_id: "gnd_source_port",
      source_component_id: "usb",
      name: "GND",
      pin_number: 1,
    },
    {
      type: "source_trace",
      source_trace_id: "gnd_net_trace",
      connected_source_port_ids: ["gnd_source_port"],
      connected_source_net_ids: ["ground"],
    },
    {
      type: "pcb_component",
      pcb_component_id: "usb_component",
      source_component_id: "usb",
      center: { x: padX, y: padY },
      width: padWidth,
      height: padHeight,
      rotation: 0,
      layer: "top",
    },
    {
      type: "pcb_port",
      pcb_port_id: "gnd_port",
      source_port_id: "gnd_source_port",
      pcb_component_id: "usb_component",
      x: padX,
      y: padY,
      layers: ["top"],
    },
    {
      type: "pcb_copper_pour",
      pcb_copper_pour_id: "ground_pour",
      shape: "brep",
      layer: "top",
      source_net_id: "ground",
      covered_with_solder_mask: true,
      brep_shape: {
        outer_ring: {
          vertices: [
            { x: -10, y: 25 },
            { x: 10, y: 25 },
            { x: 10, y: 40 },
            { x: -10, y: 40 },
          ],
        },
        inner_rings: [{ vertices: hole }],
      },
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "gnd_pad",
      pcb_port_id: "gnd_port",
      pcb_component_id: "usb_component",
      shape: "rect",
      layer: "top",
      x: padX,
      y: padY,
      width: padWidth,
      height: padHeight,
    },
  ].map((element): AnyCircuitElement => any_circuit_element.parse(element))
}

test("createCopperPolygonContactTester does not falsely treat an isolated pad inside a collinear-vertex pour hole as touching", () => {
  const copperPolygonsTouch = createCopperPolygonContactTester(1e-7)

  const ordinaryCircuit = createSameNetPourHoleCircuit({
    collinearVertices: false,
  })
  const collinearCircuit = createSameNetPourHoleCircuit({
    collinearVertices: true,
  })
  const touchingCircuit = createSameNetPourHoleCircuit({
    collinearVertices: true,
    padX: 4,
  })

  const getPolygons = (circuit: AnyCircuitElement[]) => {
    const pour = circuit.find(
      (el): el is PcbCopperPour => el.type === "pcb_copper_pour",
    )!
    const pad = circuit.find((el): el is PcbSmtPad => el.type === "pcb_smtpad")!
    return {
      pourPolygon: getPourPolygon(pour),
      padPolygon: getSmtPadPolygon(pad),
    }
  }

  const ordinary = getPolygons(ordinaryCircuit)
  const collinear = getPolygons(collinearCircuit)
  const touching = getPolygons(touchingCircuit)

  expect(copperPolygonsTouch(ordinary.padPolygon, ordinary.pourPolygon)).toBe(
    false,
  )
  expect(copperPolygonsTouch(collinear.padPolygon, collinear.pourPolygon)).toBe(
    false,
  )
  expect(copperPolygonsTouch(touching.padPolygon, touching.pourPolygon)).toBe(
    true,
  )
})

test("zero-radius pour contact test does not falsely treat a point inside a subdivided pour hole as touching", () => {
  const scaledSubdividedHole = [
    { x: -3, y: 31 },
    { x: 3, y: 31 },
    { x: 3, y: 33.07 - 5e-13 },
    { x: 3, y: 33.07 + 5e-13 },
    { x: 3, y: 36 },
    { x: -3, y: 36 },
  ]
  const circuit = createSameNetPourHoleCircuit({
    collinearVertices: true,
    hole: scaledSubdividedHole,
  })
  const connMap = getFullConnectivityMapFromCircuitJson(circuit)
  const netId = connMap.getNetConnectedToId("ground")!
  const touchesPour = getPourContactTester(circuit, connMap)

  expect(
    touchesPour({
      netId,
      layers: ["top"],
      center: { x: 0, y: 33.07 },
      radius: 0,
    }),
  ).toBe(false)
  expect(
    touchesPour({
      netId,
      layers: ["top"],
      center: { x: 4, y: 33.07 },
      radius: 0,
    }),
  ).toBe(true)
})
