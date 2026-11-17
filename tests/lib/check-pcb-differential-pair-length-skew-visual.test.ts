import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { pairFixture } from "../fixtures/differential-pair-lengths"

test("pair fixtures show lane sums and unequal hop counts", () => {
  for (const [positive, negative, caption, snapshotName] of [
    [
      [4, 6],
      [5, 5],
      "P: 4 + 6 = 10mm; N: 5 + 5 = 10mm; skew: 0mm",
      "equal-lanes",
    ],
    [[5], [5, 5], "P: 5mm; N: 5 + 5 = 10mm; skew: 5mm", "unequal-lanes"],
  ] as const) {
    const { circuit } = pairFixture([...positive], [...negative])
    const annotated: AnyCircuitElement[] = [
      ...circuit,
      {
        type: "pcb_note_text",
        layer: "top",
        pcb_note_text_id: "pcb_note_pair_lengths",
        text: caption,
        anchor_position: { x: 5.5, y: 5 },
        anchor_alignment: "center",
        font: "tscircuit2024",
        font_size: 0.4,
        color: "white",
      },
    ]
    expect(
      convertCircuitJsonToPcbSvg(annotated, { width: 1000, height: 480 }),
    ).toMatchSvgSnapshot(import.meta.path, snapshotName)
  }
})
