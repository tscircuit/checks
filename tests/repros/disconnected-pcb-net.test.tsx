import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkDanglingTraces } from "lib/check-dangling-traces/check-dangling-traces"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { runAllRoutingChecks } from "lib/run-all-checks"
import { DisconnectedPcbNet } from "../fixtures/disconnected-pcb-net"

test("two disconnected net islands have contiguous traces and no dangling ends", async () => {
  const circuit = new Circuit()
  circuit.add(<DisconnectedPcbNet />)
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()

  expect(checkTracesAreContiguous(circuitJson)).toEqual([])
  expect(checkDanglingTraces(circuitJson)).toEqual([])

  const errors = await runAllRoutingChecks(circuitJson)
  const status = errors.length ? "DETECTED" : "FAILING"
  const svg = convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
    shouldDrawErrors: true,
    showErrorsInTextOverlay: true,
  })
    .replace(/<text[^>]*data-type="pcb_error_text_overlay"[^>]*>/, (tag) =>
      tag.replace('y="20"', 'y="50"'),
    )
    .replace(
      "</svg>",
      `<text x="50%" y="24" text-anchor="middle" fill="#fbbf24" font-family="sans-serif" font-size="16">Disconnected GND net · ${status}</text></svg>`,
    )
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})

test("aggregate routing detects disconnected copper within one named net", async () => {
  const circuit = new Circuit()
  circuit.add(<DisconnectedPcbNet />)
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const errors = await runAllRoutingChecks(circuitJson)

  expect(errors).toEqual([
    expect.objectContaining({
      error_type: "pcb_port_not_connected_error",
      pcb_port_ids: ["pcb_port_0", "pcb_port_1", "pcb_port_2", "pcb_port_3"],
      message:
        "Net [GND] has disconnected PCB copper: A.pin1, B.pin1 | C.pin1, D.pin1.",
    }),
  ])
})
