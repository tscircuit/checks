import type { Box } from "@flatten-js/core"
import type {
  AnyCircuitElement,
  PcbCopperPourRect,
  PcbNoteText,
} from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"

// The reproduction uses rectangular polygons scaled by 1e6 for DRC. Draw their
// actual bounds in board-world millimeters, without changing the tested geometry.
function copperRectangle(name: string, box: Box): PcbCopperPourRect {
  return {
    type: "pcb_copper_pour",
    pcb_copper_pour_id: name,
    source_net_id: "contact_net",
    shape: "rect",
    center: { x: (box.xmin + box.xmax) / 2e6, y: (box.ymin + box.ymax) / 2e6 },
    width: (box.xmax - box.xmin) / 1e6,
    height: (box.ymax - box.ymin) / 1e6,
    layer: "top",
    covered_with_solder_mask: false,
  }
}

function note(name: string, text: string, x: number, y: number): PcbNoteText {
  return {
    type: "pcb_note_text",
    pcb_note_text_id: name,
    text,
    anchor_position: { x, y },
    anchor_alignment: "center",
    font: "tscircuit2024",
    font_size: 0.2,
    layer: "top",
    color: "#fbbf24",
  }
}

export function copperContactSnapshot(
  horizontal: Box,
  vertical: Box,
  diagnostics: AnyCircuitElement[],
  status: string,
) {
  return convertCircuitJsonToPcbSvg(
    [
      {
        type: "pcb_board",
        pcb_board_id: "contact_board",
        center: { x: 0, y: 0 },
        width: 6,
        height: 6,
        thickness: 1.6,
        num_layers: 2,
        material: "fr4",
      },
      {
        type: "source_net",
        source_net_id: "contact_net",
        name: "CONTACT",
        member_source_group_ids: [],
      },
      copperRectangle("horizontal_copper", horizontal),
      copperRectangle("vertical_copper", vertical),
      note("title", "Same-net copper contact", 0, 2.6),
      note("horizontal_label", "Horizontal: ESM", -1.2, 0.65),
      note("vertical_label", "Vertical: CJS", 1.65, 1.4),
      note("status", status, 0, -2.6),
      ...diagnostics,
    ],
    {
      width: 1200,
      height: 700,
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    },
  )
}
