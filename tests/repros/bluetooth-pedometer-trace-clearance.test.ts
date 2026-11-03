import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { checkPadTraceClearance } from "lib/check-pad-trace-clearance"
import { checkViaTraceClearance } from "lib/check-via-trace-clearance"
import fixture from "../assets/bluetooth-pedometer.routed.circuit.json"

test("Bluetooth pedometer misses nine declared trace clearance violations", () => {
  // Real board: https://tscircuit.com/techmannih/Bluetooth-pedometer
  // Source: ebe6cfad63786434183a4ec6709409ade261dfff, manual routing removed.
  // Frozen automatic output: autorouter a4fa6d48887e95abe9b11332b939d0a170aa8af0.
  // Restores the requested 0.1 mm trace rule that core omitted from its export.
  const circuit = structuredClone(fixture) as AnyCircuitElement[]
  const actual = checkEachPcbTraceNonOverlapping(circuit)
  const requested = checkEachPcbTraceNonOverlapping(circuit, {
    minClearance: 0.1,
  })
  expect(circuit.filter((element) => element.type === "pcb_trace")).toHaveLength(165)
  expect(actual).toHaveLength(0)
  expect(requested).toHaveLength(9)
  expect(checkPadTraceClearance(circuit)).toHaveLength(0)
  expect(checkViaTraceClearance(circuit)).toHaveLength(0)
  const notes: AnyCircuitElement[] = [
    `Bluetooth pedometer: board-rule errors ${actual.length}; explicit 0.1 mm check ${requested.length}`,
    "Original automatic routing; trace rule 0.1 mm, pad rule 0.05 mm",
  ].map((text, index) => ({
    type: "pcb_note_text",
    pcb_note_text_id: `pedometer_note_${index}`,
    text,
    anchor_position: { x: 0, y: 19 - index * 1.3 },
    anchor_alignment: "center",
    font: "tscircuit2024",
    font_size: 0.6,
    layer: "top",
    color: "#ffffff",
  }))
  expect(
    convertCircuitJsonToPcbSvg([...circuit, ...actual, ...notes], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
