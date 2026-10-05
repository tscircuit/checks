import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import { checkEachPcbPortConnectedToPcbTraces } from "lib/check-each-pcb-port-connected-to-pcb-trace"
import { platedPadContactFixture } from "../fixtures/plated-pad-contact"

function annotatedFixture(): AnyCircuitElement[] {
  const notes = [
    ["AM3352 USB bulk capacitor: plated-pad contact", 2.7, 0.27, "#ffffff"],
    ["Copper ring: 1.60 mm outer / 1.00 mm drill", 2.15, 0.2, "#ffd166"],
    [
      "Top trace: 0.15 mm wide; physically touches the ring",
      1.7,
      0.2,
      "#ffd166",
    ],
    [
      "Endpoint is inside drill, but the trace crosses annular copper",
      -1.35,
      0.19,
      "#ffffff",
    ],
    [
      "Endpoint offset: 0.0196 mm > old 0.0100 mm center tolerance",
      -1.8,
      0.19,
      "#ffffff",
    ],
    [
      "PREVIOUS: C_USB_BULK.pin1 not connected to USB_VBUS",
      -2.35,
      0.19,
      "#ff6b6b",
    ],
    [
      "False positive: direct plated-pad copper contact was omitted",
      -2.8,
      0.19,
      "#ff6b6b",
    ],
    [
      "EXPECTED: connected, with no disconnected-port error",
      -3.35,
      0.19,
      "#80ed99",
    ],
    [
      "Same copper; this reproduction retains the previous checker result",
      -3.8,
      0.18,
      "#ffffff",
    ],
  ] as const
  return [
    ...platedPadContactFixture(),
    ...notes.map(([text, y, font_size, color], i) => ({
      type: "pcb_note_text" as const,
      pcb_note_text_id: `note_${i}`,
      text,
      anchor_position: { x: 1, y },
      anchor_alignment: "center" as const,
      font: "tscircuit2024" as const,
      font_size,
      layer: "top" as const,
      color,
    })),
  ]
}

test("reproduce false disconnected-port error despite plated-pad copper contact", async () => {
  const circuit = annotatedFixture()
  const errors = checkEachPcbPortConnectedToPcbTraces(circuit)
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("C_USB_BULK.pin1")
  expect(errors[0].message).toContain("USB_VBUS")
  await expect(
    convertCircuitJsonToPcbSvg(circuit, { width: 1200, height: 950 }),
  ).toMatchSvgSnapshot(import.meta.path)
})
