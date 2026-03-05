import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkConnectorAccessibleOrientation } from "lib/check-connector-accessible-orientation"

const circuitJson: AnyCircuitElement[] = [
  {
    type: "pcb_board",
    pcb_board_id: "pcb_board_1",
    center: { x: 0, y: 0 },
    width: 30,
    height: 20,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
  },
  {
    type: "source_component",
    source_component_id: "source_component_usb",
    ftype: "simple_chip",
    name: "J1",
    supplier_part_numbers: {},
  },
  {
    type: "pcb_component",
    pcb_component_id: "pcb_component_usb",
    source_component_id: "source_component_usb",
    center: { x: -13.5, y: 0 },
    width: 6,
    height: 4,
    layer: "top",
    rotation: 0,
    cable_insertion_center: { x: -11, y: 0 },
    obstructs_within_bounds: false,
  },
]

test("connector orientation warning is emitted when cable insertion points inward", () => {
  const warnings = checkConnectorAccessibleOrientation(circuitJson)

  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    type: "pcb_connector_not_in_accessible_orientation_warning",
    pcb_component_id: "pcb_component_usb",
    facing_direction: "x+",
    recommended_facing_direction: "x-",
  })

  expect(
    convertCircuitJsonToPcbSvg(
      [...circuitJson, ...warnings] as AnyCircuitElement[],
      {
        shouldDrawErrors: true,
      },
    ),
  ).toMatchSvgSnapshot(import.meta.path)
})

test("connector orientation check skips components without cable_insertion_center", () => {
  const noCableInsertionCenter = circuitJson.filter(
    (el) => el.type !== "pcb_component",
  ) as AnyCircuitElement[]

  noCableInsertionCenter.push({
    type: "pcb_component",
    pcb_component_id: "pcb_component_no_connector",
    source_component_id: "source_component_usb",
    center: { x: 10, y: 0 },
    width: 2,
    height: 2,
    layer: "top",
    rotation: 0,
    obstructs_within_bounds: false,
  })

  const warnings = checkConnectorAccessibleOrientation(noCableInsertionCenter)
  expect(warnings).toHaveLength(0)
})
