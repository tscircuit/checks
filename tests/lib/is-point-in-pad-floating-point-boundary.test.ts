import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { isPointInPad } from "lib/check-traces-are-contiguous/is-point-in-pad"

const rectCircuitJson = [
  {
    type: "pcb_board",
    pcb_board_id: "pcb_board_0",
    center: { x: 2.637275, y: 1.574125 },
    width: 2.5,
    height: 2.5,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
  },
  {
    type: "source_trace",
    source_trace_id: "source_net_10",
    connected_source_port_ids: ["source_port_27", "source_port_28"],
    connected_source_net_ids: [],
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_27",
    source_port_id: "source_port_27",
    x: 2.637275000000003,
    y: 1.053424999999998,
    layers: ["bottom"],
  },
  {
    type: "pcb_port",
    pcb_port_id: "pcb_port_28",
    source_port_id: "source_port_28",
    x: 2.6372750000000034,
    y: 2.0948249999999984,
    layers: ["bottom"],
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_27",
    pcb_port_id: "pcb_port_27",
    shape: "rect",
    x: 2.637275000000003,
    y: 1.053424999999998,
    width: 1.27,
    height: 0.6604,
    layer: "bottom",
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pcb_smtpad_28",
    pcb_port_id: "pcb_port_28",
    shape: "rect",
    x: 2.6372750000000034,
    y: 2.0948249999999984,
    width: 1.27,
    height: 0.6604,
    layer: "bottom",
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_1",
    source_trace_id: "source_net_10",
    route: [
      {
        route_type: "wire",
        x: 2.637275000000003,
        y: 1.3836249999999986,
        width: 0.3175,
        layer: "bottom",
      },
      {
        route_type: "wire",
        x: 2.6372750000000034,
        y: 1.764624999999998,
        width: 0.3175,
        layer: "bottom",
      },
    ],
  },
] as AnyCircuitElement[]

const createRoundedBoundaryCircuit = ({
  fixtureId,
  createPad,
}: {
  fixtureId: string
  createPad: (args: {
    padId: string
    portId: string
    y: number
  }) => AnyCircuitElement
}) => {
  const lowerPortId = `pcb_port_${fixtureId}_lower`
  const upperPortId = `pcb_port_${fixtureId}_upper`
  const lowerSourcePortId = `source_port_${fixtureId}_lower`
  const upperSourcePortId = `source_port_${fixtureId}_upper`

  return [
    {
      type: "pcb_board",
      pcb_board_id: `pcb_board_${fixtureId}`,
      center: { x: 0, y: 1 },
      width: 3,
      height: 3,
      thickness: 1.6,
      num_layers: 2,
      material: "fr4",
    },
    {
      type: "source_trace",
      source_trace_id: `source_trace_${fixtureId}`,
      connected_source_port_ids: [lowerSourcePortId, upperSourcePortId],
      connected_source_net_ids: [],
    },
    {
      type: "pcb_port",
      pcb_port_id: lowerPortId,
      source_port_id: lowerSourcePortId,
      x: 0,
      y: 0,
      layers: ["top"],
    },
    {
      type: "pcb_port",
      pcb_port_id: upperPortId,
      source_port_id: upperSourcePortId,
      x: 0,
      y: 2,
      layers: ["top"],
    },
    createPad({
      padId: `pad_${fixtureId}_lower`,
      portId: lowerPortId,
      y: 0,
    }),
    createPad({
      padId: `pad_${fixtureId}_upper`,
      portId: upperPortId,
      y: 2,
    }),
    {
      type: "pcb_trace",
      pcb_trace_id: `pcb_trace_${fixtureId}`,
      source_trace_id: `source_trace_${fixtureId}`,
      route: [
        {
          route_type: "wire",
          x: 0,
          y: 0.5000000000000001,
          width: 0.2,
          layer: "top",
        },
        {
          route_type: "wire",
          x: 0,
          y: 1.4999999999999998,
          width: 0.2,
          layer: "top",
        },
      ],
    },
  ] as AnyCircuitElement[]
}

const rotatedPillCircuitJson = createRoundedBoundaryCircuit({
  fixtureId: "rotated_pill",
  createPad: ({ padId, portId, y }) => ({
    type: "pcb_smtpad",
    pcb_smtpad_id: padId,
    pcb_port_id: portId,
    shape: "rotated_pill",
    x: 0,
    y,
    width: 1,
    height: 2,
    radius: 0.5,
    ccw_rotation: 90,
    layer: "top",
  }),
})

const platedHoleCircuitJson = createRoundedBoundaryCircuit({
  fixtureId: "plated_hole",
  createPad: ({ padId, portId, y }) => ({
    type: "pcb_plated_hole",
    pcb_plated_hole_id: padId,
    pcb_port_id: portId,
    shape: "circle",
    x: 0,
    y,
    outer_diameter: 1,
    hole_diameter: 0.4,
    layers: ["top", "bottom"],
  }),
})

const expectBoundaryContacts = (
  circuitJson: AnyCircuitElement[],
  snapshotName: string,
) => {
  const errors = checkTracesAreContiguous(circuitJson)
  expect(errors).toHaveLength(0)
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path, snapshotName)
}

test("treats floating-point residue at a rectangular pad boundary as contact", () => {
  const pad = rectCircuitJson.find(
    (element) =>
      element.type === "pcb_smtpad" &&
      element.pcb_smtpad_id === "pcb_smtpad_27",
  )
  if (!pad || pad.type !== "pcb_smtpad") {
    throw new Error("Missing circuit018 boundary pad fixture")
  }

  expect(
    isPointInPad({ x: 2.637275000000003, y: 1.3836249999999986 }, pad),
  ).toBe(true)
  expect(isPointInPad({ x: 2.637275000000003, y: 1.383626 }, pad)).toBe(false)

  expectBoundaryContacts(rectCircuitJson, "circuit018-pad-boundary")
})

test("treats floating-point residue at a rotated-pill pad boundary as contact", () => {
  const pad = rotatedPillCircuitJson.find(
    (element) =>
      element.type === "pcb_smtpad" &&
      element.pcb_smtpad_id === "pad_rotated_pill_lower",
  )
  if (!pad || pad.type !== "pcb_smtpad") {
    throw new Error("Missing rotated-pill boundary pad fixture")
  }

  expect(isPointInPad({ x: 0, y: 0.5000000000000001 }, pad)).toBe(true)
  expect(isPointInPad({ x: 0, y: 0.500001 }, pad)).toBe(false)
  expectBoundaryContacts(rotatedPillCircuitJson, "rotated-pill-pad-boundary")
})

test("treats floating-point residue at a circular plated-hole boundary as contact", () => {
  const pad = platedHoleCircuitJson.find(
    (element) =>
      element.type === "pcb_plated_hole" &&
      element.pcb_plated_hole_id === "pad_plated_hole_lower",
  )
  if (!pad || pad.type !== "pcb_plated_hole") {
    throw new Error("Missing circular plated-hole boundary fixture")
  }

  expect(isPointInPad({ x: 0, y: 0.5000000000000001 }, pad)).toBe(true)
  expect(isPointInPad({ x: 0, y: 0.500001 }, pad)).toBe(false)
  expectBoundaryContacts(platedHoleCircuitJson, "circular-plated-hole-boundary")
})

test("uses the rounded boundary of a rotated plated-hole pill", () => {
  const pad = {
    type: "pcb_plated_hole",
    pcb_plated_hole_id: "plated_pill",
    shape: "pill",
    x: 0,
    y: 0,
    outer_width: 3.2,
    outer_height: 3,
    hole_width: 2.4,
    hole_height: 2.2,
    ccw_rotation: 90,
    layers: ["top", "bottom"],
  } as const

  expect(isPointInPad({ x: 0, y: 1.6 }, pad)).toBe(true)
  expect(isPointInPad({ x: 0, y: 1.600001 }, pad)).toBe(false)
  expect(isPointInPad({ x: 1.5, y: 1.4 }, pad)).toBe(false)
})
