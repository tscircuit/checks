import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbCopperPour, SourceNet } from "circuit-json"
import { checkCopperPourTraceClearance } from "lib/check-copper-pour-trace-clearance"

const groundNet: SourceNet = {
  type: "source_net",
  source_net_id: "source_net_ground",
  name: "GND",
  member_source_group_ids: [],
  is_ground: true,
}

const signalNet: SourceNet = {
  type: "source_net",
  source_net_id: "source_net_signal",
  name: "SIGNAL",
  member_source_group_ids: [],
}

const getCircuitJson = ({
  copperPour,
  traceNetId,
  traceStartX = -4,
  traceEndX = 4,
}: {
  copperPour: PcbCopperPour
  traceNetId: string
  traceStartX?: number
  traceEndX?: number
}): AnyCircuitElement[] => [
  groundNet,
  signalNet,
  {
    type: "source_trace",
    source_trace_id: "source_trace_signal",
    connected_source_port_ids: [],
    connected_source_net_ids: [traceNetId],
  },
  copperPour,
  {
    type: "pcb_trace",
    pcb_trace_id: "signal_trace",
    source_trace_id: "source_trace_signal",
    route: [
      {
        route_type: "wire",
        x: traceStartX,
        y: 0,
        width: 0.2,
        layer: "top",
      },
      {
        route_type: "wire",
        x: traceEndX,
        y: 0,
        width: 0.2,
        layer: "top",
      },
    ],
  },
]

const brepCopperPour: Extract<PcbCopperPour, { shape: "brep" }> = {
  type: "pcb_copper_pour",
  pcb_copper_pour_id: "brep_pour",
  source_net_id: groundNet.source_net_id,
  shape: "brep",
  brep_shape: {
    outer_ring: {
      vertices: [
        { x: -2, y: -1.5 },
        { x: 2, y: -1.5 },
        { x: 2, y: 1.5 },
        { x: -2, y: 1.5 },
      ],
    },
    inner_rings: [],
  },
  layer: "top",
  covered_with_solder_mask: true,
}

const copperPourVariants: PcbCopperPour[] = [
  {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "rect_pour",
    source_net_id: groundNet.source_net_id,
    shape: "rect",
    center: { x: 0, y: 0 },
    width: 4,
    height: 3,
    layer: "top",
    covered_with_solder_mask: true,
  },
  {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: "polygon_pour",
    source_net_id: groundNet.source_net_id,
    shape: "polygon",
    points: [
      { x: -2, y: -1.5 },
      { x: 2, y: -1.5 },
      { x: 2, y: 1.5 },
      { x: -2, y: 1.5 },
    ],
    layer: "top",
    covered_with_solder_mask: true,
  },
  brepCopperPour,
]

test.each(copperPourVariants)(
  "reports different-net trace contact with $shape copper pour",
  (copperPour) => {
    const circuitJson = getCircuitJson({
      copperPour,
      traceNetId: signalNet.source_net_id,
    })

    expect(checkCopperPourTraceClearance(circuitJson)).toHaveLength(1)
  },
)

test("allows a trace connected to the copper-pour net", () => {
  const circuitJson = getCircuitJson({
    copperPour: brepCopperPour,
    traceNetId: groundNet.source_net_id,
  })

  expect(checkCopperPourTraceClearance(circuitJson)).toEqual([])
})

test("does not treat a BREP inner ring as copper", () => {
  const brepPourWithHole: PcbCopperPour = {
    ...brepCopperPour,
    pcb_copper_pour_id: "brep_pour_with_hole",
    shape: "brep",
    brep_shape: {
      outer_ring: brepCopperPour.brep_shape.outer_ring,
      inner_rings: [
        {
          vertices: [
            { x: -1.5, y: -0.5 },
            { x: 1.5, y: -0.5 },
            { x: 1.5, y: 0.5 },
            { x: -1.5, y: 0.5 },
          ],
        },
      ],
    },
  }
  const circuitJson = getCircuitJson({
    copperPour: brepPourWithHole,
    traceNetId: signalNet.source_net_id,
    traceStartX: -1,
    traceEndX: 1,
  })

  expect(checkCopperPourTraceClearance(circuitJson)).toEqual([])
})
