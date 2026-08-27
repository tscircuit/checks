import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkSourceNetsArePhysicallyConnected } from "lib/check-source-nets-are-physically-connected"
import { runAllRoutingChecks } from "lib/run-all-checks"
import {
  createSplitSourceNetCircuitJson,
  splitSourceNetId,
} from "tests/fixtures/source-net-physical-connectivity"

test("reports a four-port source net split into two copper groups", async () => {
  const circuitJson = createSplitSourceNetCircuitJson()
  const errors = checkSourceNetsArePhysicallyConnected(circuitJson)

  expect(errors).toEqual([
    expect.objectContaining({
      type: "pcb_trace_error",
      pcb_trace_error_id: `disconnected_copper_groups_${splitSourceNetId}`,
      pcb_port_ids: ["pcb_port_0", "pcb_port_1", "pcb_port_2", "pcb_port_3"],
      message:
        "Net [SPLIT_NET] has 4 required PCB ports split across 2 disconnected copper groups.",
    }),
  ])
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
  expect(await runAllRoutingChecks(circuitJson)).toContainEqual(
    expect.objectContaining({
      pcb_trace_error_id: `disconnected_copper_groups_${splitSourceNetId}`,
    }),
  )

  const bridgeTrace: AnyCircuitElement = {
    type: "pcb_trace",
    pcb_trace_id: "pcb_trace_bridge",
    source_trace_id: splitSourceNetId,
    route: [
      { route_type: "wire", x: -3, y: 0, width: 0.2, layer: "top" },
      { route_type: "wire", x: 3, y: 0, width: 0.2, layer: "top" },
    ],
  }
  expect(
    checkSourceNetsArePhysicallyConnected([...circuitJson, bridgeTrace]),
  ).toHaveLength(0)
})
