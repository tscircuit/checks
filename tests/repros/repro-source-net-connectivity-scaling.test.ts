import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkSourceNetsArePhysicallyConnected } from "lib/check-source-nets-are-physically-connected"

const copperGroupCount = 500
const sourceNetId = "source_net_large_split"

const createLargeSplitNet = (): AnyCircuitElement[] => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_net",
      source_net_id: sourceNetId,
      name: "LARGE_SPLIT_NET",
      member_source_group_ids: [],
    },
  ]

  for (let groupIndex = 0; groupIndex < copperGroupCount; groupIndex++) {
    const y = groupIndex * 2
    const firstPortIndex = groupIndex * 2
    const secondPortIndex = firstPortIndex + 1

    for (const [portIndex, x] of [
      [firstPortIndex, -1],
      [secondPortIndex, 1],
    ] as const) {
      circuitJson.push(
        {
          type: "source_trace",
          source_trace_id: `source_trace_${portIndex}`,
          connected_source_port_ids: [`source_port_${portIndex}`],
          connected_source_net_ids: [sourceNetId],
        },
        {
          type: "pcb_port",
          pcb_port_id: `pcb_port_${portIndex}`,
          source_port_id: `source_port_${portIndex}`,
          x,
          y,
          layers: ["top"],
        },
        {
          type: "pcb_smtpad",
          pcb_smtpad_id: `pcb_smtpad_${portIndex}`,
          pcb_port_id: `pcb_port_${portIndex}`,
          shape: "rect",
          x,
          y,
          width: 0.8,
          height: 0.8,
          layer: "top",
        },
      )
    }

    circuitJson.push({
      type: "pcb_trace",
      pcb_trace_id: `pcb_trace_group_${groupIndex}`,
      source_trace_id: sourceNetId,
      route: [
        {
          route_type: "wire",
          x: -1,
          y,
          width: 0.2,
          layer: "top",
          start_pcb_port_id: `pcb_port_${firstPortIndex}`,
        },
        {
          route_type: "wire",
          x: 1,
          y,
          width: 0.2,
          layer: "top",
          end_pcb_port_id: `pcb_port_${secondPortIndex}`,
        },
      ],
    })
  }

  return circuitJson
}

test("checks 1,000 required ports split across 500 copper groups", () => {
  const circuitJson = createLargeSplitNet()
  const errors = checkSourceNetsArePhysicallyConnected(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    pcb_trace_error_id: `disconnected_copper_groups_${sourceNetId}`,
    message:
      "Net [LARGE_SPLIT_NET] has 1000 required PCB ports split across 500 disconnected copper groups.",
  })
}, 15_000)
