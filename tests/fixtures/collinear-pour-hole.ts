import { any_circuit_element, type AnyCircuitElement } from "circuit-json"

export const safePadX = -0.2499360000000003
export const padY = 33.6450052
export const padWidth = 0.2999994
export const padHeight = 1.1500104

// Both rings describe the same 6 x 5 mm rectangular clearance hole. The two
// extra vertices only subdivide its right edge; they do not change any copper.
export const ordinaryHole = [
  { x: -3, y: 31 },
  { x: 3, y: 31 },
  { x: 3, y: 36 },
  { x: -3, y: 36 },
]
export const collinearHole = [
  { x: -3, y: 31 },
  { x: 3, y: 31 },
  { x: 3, y: 33.069999 },
  { x: 3, y: 33.070001 },
  { x: 3, y: 36 },
  { x: -3, y: 36 },
]

export function createPourHoleCircuit({
  collinearVertices = false,
  padX = safePadX,
}: {
  collinearVertices?: boolean
  padX?: number
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
      source_port_id: "signal_source_port",
      source_component_id: "usb",
      name: "SIGNAL",
      pin_number: 1,
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
      pcb_port_id: "signal_port",
      source_port_id: "signal_source_port",
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
        inner_rings: [
          { vertices: collinearVertices ? collinearHole : ordinaryHole },
        ],
      },
    },
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "signal_pad",
      pcb_port_id: "signal_port",
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
