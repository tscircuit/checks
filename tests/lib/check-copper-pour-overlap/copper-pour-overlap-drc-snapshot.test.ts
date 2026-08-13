import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkCopperPourOverlap } from "lib/check-copper-pour-overlap/checkCopperPourOverlap"

test("overlapping different-net copper pours render a DRC error", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_board",
      pcb_board_id: "board1",
      center: { x: 0, y: 0 },
      width: 20,
      height: 14,
      thickness: 1.4,
      num_layers: 2,
      material: "fr4",
    },
    {
      type: "source_net",
      source_net_id: "source_net_gnd",
      name: "GND",
      member_source_group_ids: [],
    },
    {
      type: "source_net",
      source_net_id: "source_net_vcc",
      name: "VCC",
      member_source_group_ids: [],
    },
    {
      type: "pcb_copper_pour",
      pcb_copper_pour_id: "pour_gnd",
      shape: "polygon",
      layer: "top",
      source_net_id: "source_net_gnd",
      points: [
        { x: -9, y: -6 },
        { x: 3, y: -6 },
        { x: 3, y: 6 },
        { x: -9, y: 6 },
      ],
      covered_with_solder_mask: true,
    },
    {
      type: "pcb_copper_pour",
      pcb_copper_pour_id: "pour_vcc",
      shape: "polygon",
      layer: "top",
      source_net_id: "source_net_vcc",
      points: [
        { x: -3, y: -6 },
        { x: 9, y: -6 },
        { x: 9, y: 6 },
        { x: -3, y: 6 },
      ],
      covered_with_solder_mask: true,
    },
  ]

  const errors = checkCopperPourOverlap(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0]!.center).toBeDefined()

  const svg = convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
    shouldDrawErrors: true,
  })

  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
