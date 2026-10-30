import type { AnyCircuitElement, PcbNoteText } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"

const noteText = ({
  text,
  x = 0,
  y,
  font_size = 0.22,
  color = "#ffffff",
}: {
  text: string
  x?: number
  y: number
  font_size?: number
  color?: string
}): PcbNoteText => ({
  type: "pcb_note_text",
  pcb_note_text_id: `proof_text_${x}_${y}`,
  text,
  anchor_position: { x, y },
  anchor_alignment: "center",
  font: "tscircuit2024",
  font_size,
  layer: "top",
  color,
})

/**
 * The PCB is rendered unchanged. Only the live checker's result is annotated.
 * Diagnostic centers are absolute board points in mm: +X right, +Y up.
 * Native note geometry marks error locations the SVG renderer does not draw.
 */
export function renderCutoutClearanceProof(
  circuitJson: AnyCircuitElement[],
  errors: readonly {
    message: string
    center?: { x?: number; y?: number }
    actual_clearance?: number
    minimum_clearance?: number
  }[],
) {
  const annotations: AnyCircuitElement[] = [
    noteText({ text: "USB SLOT INTERSECTS COPPER", y: 2.5, font_size: 0.3 }),
    noteText({ text: "Identical PCB geometry; actual DRC output", y: 1.9 }),
    noteText({ text: "VM_TO_ADC_DIVIDER", y: 0.9 }),
    noteText({
      text: "Magenta opening = no board material",
      y: -0.8,
      font_size: 0.2,
    }),
    noteText({
      text: `${errors.length ? "DETECTED" : "MISSED"}: ${errors.length} cutout violation${errors.length === 1 ? "" : "s"}`,
      y: -1.4,
      font_size: 0.3,
      color: errors.length ? "#ffff00" : "#ff7777",
    }),
  ]

  for (const [index, error] of errors.entries()) {
    if (
      error.center?.x === undefined ||
      error.center.y === undefined ||
      error.actual_clearance === undefined ||
      error.minimum_clearance === undefined
    ) {
      throw new Error(
        "Expected a measured cutout diagnostic with a PCB location",
      )
    }
    annotations.push(
      {
        type: "pcb_note_rect",
        pcb_note_rect_id: `reported_cutout_location_${index}`,
        center: { x: error.center.x, y: error.center.y },
        width: 0.6,
        height: 0.6,
        stroke_width: 0.04,
        layer: "top",
        color: "#ffff00",
        is_filled: false,
      },
      noteText({
        text: `Error ${index + 1}: ${error.actual_clearance.toFixed(3)}mm measured / ${error.minimum_clearance.toFixed(3)}mm required`,
        y: -2 - index * 0.4,
        font_size: 0.2,
        color: "#ffff00",
      }),
    )
  }

  return convertCircuitJsonToPcbSvg([...circuitJson, ...annotations], {
    width: 1200,
    height: 850,
    showPcbNotes: true,
  })
}
