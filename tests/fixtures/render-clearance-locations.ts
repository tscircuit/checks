import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"

/** Numbered crosshairs show error.center exactly, including error types the
 * SVG renderer does not yet draw. Numbers correspond to the coordinate table. */
export function renderClearanceLocations(
  circuit: AnyCircuitElement[],
  errors: { center: { x: number; y: number } }[],
) {
  const width = 1200
  const height = 500
  const viewport = { minX: -10, maxX: 35, minY: 8, maxY: 25 }
  const scale = Math.min(width / 45, height / 17)
  const svg = convertCircuitJsonToPcbSvg(circuit, { width, height, viewport })
  const groups = new Map<string, { x: number; y: number; labels: number[] }>()
  for (const [index, { center }] of errors.entries()) {
    const key = JSON.stringify(center)
    const group = groups.get(key) ?? { ...center, labels: [] }
    group.labels.push(index + 1)
    groups.set(key, group)
  }
  const markers = [...groups.values()].map(({ x, y, labels }) => {
    const sx = width / 2 + (x - 12.5) * scale
    const sy = height / 2 - (y - 16.5) * scale
    return `<g transform="translate(${sx} ${sy})"><circle r="5" fill="black" stroke="#ffff00" stroke-width="2"/><path d="M-9 0H9M0-9V9" stroke="#ffff00"/><text x="10" y="-8" font-family="sans-serif" font-size="15" font-weight="bold" fill="#ffff00" stroke="black" stroke-width="3" paint-order="stroke">${labels.join(",")}</text></g>`
  })
  return svg.replace("</svg>", `${markers.join("")}</svg>`)
}
