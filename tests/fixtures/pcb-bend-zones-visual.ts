import type {
  AnyCircuitElement,
  PcbSilkscreenText,
  PcbSilkscreenLine,
} from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbBendZonePlacement, checkPcbBendZoneTraces } from "../../index"
import { board, bend, via, pad, trace, stiffener } from "./pcb-bend-zones"

const text = (
  id: string,
  value: string,
  x: number,
  y: number,
  font_size = 0.45,
): PcbSilkscreenText => ({
  type: "pcb_silkscreen_text",
  pcb_silkscreen_text_id: id,
  pcb_component_id: "",
  layer: "top",
  text: value,
  anchor_position: { x, y },
  anchor_alignment: "center",
  font: "tscircuit2024",
  font_size,
})

const line = (
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): PcbSilkscreenLine => ({
  type: "pcb_silkscreen_line",
  pcb_silkscreen_line_id: id,
  pcb_component_id: "",
  layer: "top",
  x1,
  y1,
  x2,
  y2,
  stroke_width: 0.05,
})

export function bendZoneVisual(passing: boolean) {
  const partX = passing ? -4 : 0
  const backing = {
    ...stiffener,
    pcb_stiffener_id: "BACKING",
    center: { x: partX, y: -4 },
  }
  const circuit: AnyCircuitElement[] = [
    { ...board, width: 28, height: 24 },
    { ...bend, start: { x: 0, y: -6 }, end: { x: 0, y: 6 } },
    via("VIA", partX, 4),
    pad("PAD", partX, 1),
    backing,
    trace(
      "SIGNAL",
      passing
        ? [
            [-6, -1],
            [5, -1],
          ]
        : [
            [-6, -1],
            [0, -1],
            [2, -2.5],
          ],
      0.2,
    ),
    // This via lies beyond the finite bend end in BOTH cases.
    via("BEYOND_END", 0, 7),
  ]
  const placement = checkPcbBendZonePlacement(circuit)
  const routing = checkPcbBendZoneTraces(circuit)

  // Flat board-world mm (+X right, +Y up). The silkscreen outlines annotate
  // the finite zone and the actual bottom backing's footprint in this top view.
  // They are explanatory markings, not copper or an additional DRC keepout.
  const halfWidth =
    (bend.bend_radius * Math.abs((bend.bend_angle * Math.PI) / 180)) / 2
  const annotations: AnyCircuitElement[] = [
    text(
      "title",
      passing
        ? "PASS: COMPONENTS CLEAR OF BEND"
        : "FAIL: COMPONENTS INSIDE BEND",
      0,
      10.5,
      0.65,
    ),
    text(
      "legend",
      "Yellow dashed box = bend zone. Copper shown in red.",
      0,
      9.4,
      0.42,
    ),
    text("width", "R=1mm, 90deg: zone is 1.57mm wide x 12mm long", 0, 8.5, 0.4),
    text("end-via", "Beyond end: OK", 6, 7, 0.42),
    line("end-leader", 3.8, 7, 0.4, 7),
    text(
      "via-label",
      passing ? "VIA: outside zone" : "VIA: overlaps zone",
      7,
      4,
    ),
    line("via-leader", 4.2, 4, partX + 0.5, 4),
    text(
      "pad-label",
      passing ? "PAD: outside zone" : "PAD: overlaps zone",
      7,
      1,
    ),
    line("pad-leader", 4.2, 1, partX + 0.5, 1),
    text(
      "trace-label",
      passing ? "TRACE: perpendicular" : "TRACE: corner in zone",
      7,
      -2.5,
      0.42,
    ),
    line("trace-leader", 4, -2.5, passing ? 1 : 0, -1.2),
    text(
      "backing-label",
      passing ? "BACKING: outside zone" : "BACKING: overlaps zone",
      7,
      -4.7,
      0.42,
    ),
    line("backing-leader", 4, -4.7, partX + 1.1, -4.3),
    text(
      "backing-legend",
      "Yellow solid rectangle = bottom stiffener footprint",
      0,
      -7,
      0.4,
    ),
    text(
      "result",
      `CHECK RESULT: ${placement.length} placement errors, ${routing.length} trace errors`,
      0,
      -8.3,
      0.5,
    ),
    text(
      "fix",
      passing
        ? "Move parts away; cross straight at 90deg to bend."
        : "Via, pad, backing and trace each fail this bend check.",
      0,
      -9.4,
      0.4,
    ),
    text(
      "scope",
      "Bend-zone checks only; other PCB DRC rules are separate.",
      0,
      -10.5,
      0.38,
    ),
  ]
  for (const x of [-halfWidth, halfWidth]) {
    for (let y = -6; y < 6; y += 0.6) {
      annotations.push(line(`zone-${x}-${y}`, x, y, x, y + 0.3))
    }
  }
  annotations.push(line("zone-start", -halfWidth, -6, halfWidth, -6))
  annotations.push(line("zone-end", -halfWidth, 6, halfWidth, 6))
  const corners = [
    [
      backing.center.x - backing.width / 2,
      backing.center.y - backing.height / 2,
    ],
    [
      backing.center.x + backing.width / 2,
      backing.center.y - backing.height / 2,
    ],
    [
      backing.center.x + backing.width / 2,
      backing.center.y + backing.height / 2,
    ],
    [
      backing.center.x - backing.width / 2,
      backing.center.y + backing.height / 2,
    ],
  ]
  corners.forEach(([x, y], i) => {
    const [nextX, nextY] = corners[(i + 1) % corners.length]
    annotations.push(line(`backing-${i}`, x, y, nextX, nextY))
  })
  return {
    placement,
    routing,
    svg: convertCircuitJsonToPcbSvg([...circuit, ...annotations], {
      width: 980,
      height: 840,
      viewport: { minX: -14, maxX: 14, minY: -12, maxY: 12 },
      layer: "top",
    }),
  }
}
