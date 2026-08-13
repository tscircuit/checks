import { describe, expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkCopperPourOverlap } from "lib/check-copper-pour-overlap/checkCopperPourOverlap"

type Pt = { x: number; y: number }

const board: AnyCircuitElement = {
  type: "pcb_board",
  pcb_board_id: "board1",
  center: { x: 0, y: 0 },
  width: 20,
  height: 14,
  thickness: 1.4,
  num_layers: 2,
  material: "fr4",
}

const net = (id: string, name: string): AnyCircuitElement => ({
  type: "source_net",
  source_net_id: id,
  name,
  member_source_group_ids: [],
})

const pour = (
  id: string,
  sourceNetId: string,
  layer: "top" | "bottom",
  points: Pt[],
): AnyCircuitElement => ({
  type: "pcb_copper_pour",
  pcb_copper_pour_id: id,
  shape: "polygon",
  layer,
  source_net_id: sourceNetId,
  points,
  covered_with_solder_mask: true,
})

// x from -9 to 3
const leftPoints: Pt[] = [
  { x: -9, y: -6 },
  { x: 3, y: -6 },
  { x: 3, y: 6 },
  { x: -9, y: 6 },
]
// x from -3 to 9, overlaps leftPoints across x in [-3, 3]
const rightPoints: Pt[] = [
  { x: -3, y: -6 },
  { x: 9, y: -6 },
  { x: 9, y: 6 },
  { x: -3, y: 6 },
]
// x from -9 to -1, disjoint from rightDisjoint below
const leftDisjointPoints: Pt[] = [
  { x: -9, y: -6 },
  { x: -1, y: -6 },
  { x: -1, y: 6 },
  { x: -9, y: 6 },
]
// x from 1 to 9
const rightDisjointPoints: Pt[] = [
  { x: 1, y: -6 },
  { x: 9, y: -6 },
  { x: 9, y: 6 },
  { x: 1, y: 6 },
]

describe("checkCopperPourOverlap", () => {
  test("flags overlapping different-net pours on the same layer", () => {
    const circuitJson: AnyCircuitElement[] = [
      board,
      net("source_net_gnd", "GND"),
      net("source_net_vcc", "VCC"),
      pour("pour_gnd", "source_net_gnd", "top", leftPoints),
      pour("pour_vcc", "source_net_vcc", "top", rightPoints),
    ]
    const errors = checkCopperPourOverlap(circuitJson)
    expect(errors).toHaveLength(1)
    expect(errors[0]!.type).toBe("pcb_trace_error")
    expect(errors[0]!.message).toContain("GND")
    expect(errors[0]!.message).toContain("VCC")
    expect(errors[0]!.message).toContain("short")
    expect(errors[0]!.center).toBeDefined()
  })

  test("does not flag overlapping pours on the same net", () => {
    const circuitJson: AnyCircuitElement[] = [
      board,
      net("source_net_gnd", "GND"),
      pour("pour_a", "source_net_gnd", "top", leftPoints),
      pour("pour_b", "source_net_gnd", "top", rightPoints),
    ]
    expect(checkCopperPourOverlap(circuitJson)).toHaveLength(0)
  })

  test("does not flag overlapping pours on different layers", () => {
    const circuitJson: AnyCircuitElement[] = [
      board,
      net("source_net_gnd", "GND"),
      net("source_net_vcc", "VCC"),
      pour("pour_gnd", "source_net_gnd", "top", leftPoints),
      pour("pour_vcc", "source_net_vcc", "bottom", rightPoints),
    ]
    expect(checkCopperPourOverlap(circuitJson)).toHaveLength(0)
  })

  test("does not flag different-net pours with disjoint outlines", () => {
    const circuitJson: AnyCircuitElement[] = [
      board,
      net("source_net_gnd", "GND"),
      net("source_net_vcc", "VCC"),
      pour("pour_gnd", "source_net_gnd", "top", leftDisjointPoints),
      pour("pour_vcc", "source_net_vcc", "top", rightDisjointPoints),
    ]
    expect(checkCopperPourOverlap(circuitJson)).toHaveLength(0)
  })

  test("does not flag overlapping pours whose nets are electrically tied", () => {
    const circuitJson: AnyCircuitElement[] = [
      board,
      net("source_net_gnd", "GND"),
      net("source_net_vcc", "VCC"),
      {
        type: "source_trace",
        source_trace_id: "tie_trace",
        connected_source_port_ids: [],
        connected_source_net_ids: ["source_net_gnd", "source_net_vcc"],
      },
      pour("pour_gnd", "source_net_gnd", "top", leftPoints),
      pour("pour_vcc", "source_net_vcc", "top", rightPoints),
    ]
    expect(checkCopperPourOverlap(circuitJson)).toHaveLength(0)
  })
})
