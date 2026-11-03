import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbTraceViaCounts } from "lib/check-pcb-trace-via-counts"
import { checkPcbTraceLengths } from "lib/check-pcb-trace-lengths"
import { getPcbTraceLength } from "lib/util/get-pcb-trace-length"
import fixture from "../assets/bluetooth-pedometer-clock.circuit.json"

test("real pedometer clock violations are reported when copper belongs to the net", () => {
  // https://tscircuit.com/techmannih/Bluetooth-pedometer @ ebe6cfad63786434183a4ec6709409ade261dfff.
  // Automatic output from autorouter a4fa6d48887e95abe9b11332b939d0a170aa8af0.
  // Original source/PCB geometry plus SRJ-converted copper; source-port references
  // are restored to the original PCB ports. No route coordinates are changed.
  const circuit = structuredClone(fixture) as AnyCircuitElement[]
  const clock = circuit.find((element) => element.type === "pcb_trace" && element.pcb_trace_id === "source_net_29_0") as PcbTrace
  const length = getPcbTraceLength(clock)
  const vias = clock.route.filter((point) => point.route_type === "via").length
  expect(vias).toBe(2)
  expect(length).toBeCloseTo(10.6106, 4)
  const errors = [...checkPcbTraceViaCounts(circuit), ...checkPcbTraceLengths(circuit)]
    .filter((error) => error.source_trace_id === "source_trace_217")
  expect(errors).toHaveLength(2)
  const note: AnyCircuitElement = {
    type: "pcb_note_text", pcb_note_text_id: "clock_rule_caption",
    text: `X48_N: ${vias} vias / ${length.toFixed(2)} mm including vias; allowed 0 / 6; reported errors ${errors.length}`,
    anchor_position: { x: 0, y: 18 }, anchor_alignment: "center",
    font: "tscircuit2024", font_size: 0.65, layer: "top", color: "#ffffff",
  }
  expect(convertCircuitJsonToPcbSvg([...circuit, note])).toMatchSvgSnapshot(import.meta.path)
})
