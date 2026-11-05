import type { AnyCircuitElement, PcbTrace, PcbTraceError } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"

export type PcbWindow = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

type NumberedError = { number: number; error: PcbTraceError }

const PANEL_WIDTH = 1200
const PANEL_HEIGHT = 900
const LEGEND_WIDTH = 500
const MARKER_COLOR = "#ffe600"
const MERGE_LABELS_WITHIN_PX = 22
const FONT = "font-family='Helvetica, Arial, sans-serif'"

const COPPER = {
  top: "rgb(200,52,52)",
  inner1: "rgb(214,170,60)",
  inner2: "rgb(190,110,210)",
  bottom: "rgb(77,127,196)",
}
const DIMMED_COPPER = {
  top: "rgba(200,52,52,0.2)",
  inner1: "rgba(214,170,60,0.09)",
  inner2: "rgba(190,110,210,0.14)",
  bottom: "rgba(77,127,196,0.2)",
}
type CopperLayer = keyof typeof COPPER

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const contains = (window: PcbWindow, { x, y }: { x: number; y: number }) =>
  x >= window.minX && x <= window.maxX && y >= window.minY && y <= window.maxY

/** The viewport option still writes the whole board into every SVG, so a crop
 * keeps only what reaches its window. Pours are hidden to keep inner-layer
 * stubs visible. The checks still ran with them. */
const isDrawnInWindow = (element: any, window: PcbWindow, margin: number) => {
  if (!element.type.startsWith("pcb_") || element.type === "pcb_board") {
    return true
  }
  if (element.type === "pcb_copper_pour") return false
  const points: { x?: number; y?: number }[] = element.route ??
    element.points ?? [element.anchor_position ?? element]
  const placed = points.filter(
    (point) => typeof point?.x === "number" && typeof point?.y === "number",
  ) as { x: number; y: number }[]
  if (placed.length === 0) return false
  return (
    Math.min(...placed.map(({ x }) => x)) <= window.maxX + margin &&
    Math.max(...placed.map(({ x }) => x)) >= window.minX - margin &&
    Math.min(...placed.map(({ y }) => y)) <= window.maxY + margin &&
    Math.max(...placed.map(({ y }) => y)) >= window.minY - margin
  )
}

const renderPanel = (
  circuit: AnyCircuitElement[],
  window: PcbWindow,
  focusLayers: Set<string>,
) => {
  const drawn = circuit.filter(
    (element) =>
      !element.type.endsWith("_error") &&
      !element.type.endsWith("_warning") &&
      isDrawnInWindow(element, window, 5),
  )
  const copper = { ...DIMMED_COPPER }
  for (const layer of focusLayers) {
    copper[layer as CopperLayer] = COPPER[layer as CopperLayer]
  }
  const svg = convertCircuitJsonToPcbSvg(drawn, {
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    viewport: window,
    backgroundColor: "#0b0d10",
    showSolderMask: false,
    showSolderPaste: false,
    showCourtyards: false,
    showFabricationNotes: false,
    showPcbNotes: false,
    includeVersion: false,
    colorOverrides: {
      copper,
      silkscreen: {
        top: "rgba(255,255,255,0.1)",
        bottom: "rgba(255,255,255,0.05)",
      },
      substrate: "#12161a",
      boardOutline: "rgba(255,255,255,0.45)",
    },
  })
  const width = window.maxX - window.minX
  const height = window.maxY - window.minY
  const scale = Math.min(PANEL_WIDTH / width, PANEL_HEIGHT / height)
  const offsetX = (PANEL_WIDTH - width * scale) / 2
  const offsetY = (PANEL_HEIGHT - height * scale) / 2
  return {
    svg,
    scale,
    toPixels: ({ x, y }: { x: number; y: number }) => ({
      x: offsetX + (x - window.minX) * scale,
      y: PANEL_HEIGHT - offsetY - (y - window.minY) * scale,
    }),
  }
}

const getEndpointLayer = (
  circuit: AnyCircuitElement[],
  { pcb_trace_id, center }: PcbTraceError,
) => {
  const trace = circuit.find(
    (element): element is PcbTrace =>
      element.type === "pcb_trace" && element.pcb_trace_id === pcb_trace_id,
  )
  const ends = [trace?.route[0], trace?.route.at(-1)].filter(
    (point) => point && "x" in point,
  ) as { x: number; y: number; layer?: string; route_type: string }[]
  const end = ends.sort(
    (a, b) =>
      Math.hypot(a.x - center!.x, a.y - center!.y) -
      Math.hypot(b.x - center!.x, b.y - center!.y),
  )[0]
  return end?.layer ?? "via"
}

const legendEntry = (
  { number, error }: NumberedError,
  layer: string,
  y: number,
) => {
  const name = error.message.match(/\[(.*)\]/)?.[1] ?? error.pcb_trace_id
  const location = `(${error.center!.x.toFixed(2)}, ${error.center!.y.toFixed(2)})`
  const description =
    layer === "via"
      ? `via going nowhere at ${location}`
      : `free end on ${layer} at ${location}`
  return (
    `<text x="20" y="${y}" ${FONT} font-size="15" fill="#e8ecf1"><tspan fill="${MARKER_COLOR}" font-weight="bold">${number}</tspan> ${escapeXml(name ?? "")}</text>` +
    `<text x="20" y="${y + 17}" ${FONT} font-size="13" fill="#8b949e">${description}</text>`
  )
}

/** Yellow rings show error.center exactly. Numbers are the error's position in
 * checkDanglingTraces output, so they match across all views. */
export function renderDanglingEndpoints(
  circuit: AnyCircuitElement[],
  errors: PcbTraceError[],
  window: PcbWindow,
  title: string,
) {
  const visible = errors
    .map((error, index) => ({ number: index + 1, error }))
    .filter(({ error }) => contains(window, error.center!))
  const layers = new Map(
    visible.map(({ number, error }) => [
      number,
      getEndpointLayer(circuit, error),
    ]),
  )
  const { svg, scale, toPixels } = renderPanel(
    circuit,
    window,
    new Set(
      [...layers.values()].flatMap((layer) =>
        layer === "via" ? Object.keys(COPPER) : [layer],
      ),
    ),
  )

  // Ends closer than a label share one, or their numbers would overlap.
  const labels: { x: number; y: number; numbers: number[] }[] = []
  const rings = visible.map(({ number, error }) => {
    const { x, y } = toPixels(error.center!)
    const label = labels.find(
      (candidate) =>
        Math.hypot(candidate.x - x, candidate.y - y) < MERGE_LABELS_WITHIN_PX,
    )
    if (label) label.numbers.push(number)
    else labels.push({ x, y, numbers: [number] })
    return `<circle cx="${x}" cy="${y}" r="11" fill="none" stroke="black" stroke-width="5"/><circle cx="${x}" cy="${y}" r="11" fill="none" stroke="${MARKER_COLOR}" stroke-width="2.5"/>`
  })
  const labelText = labels.map(
    ({ x, y, numbers }) =>
      `<text x="${x + 15}" y="${y - 9}" ${FONT} font-size="17" font-weight="bold" fill="${MARKER_COLOR}" stroke="black" stroke-width="3.5" paint-order="stroke">${numbers.join(",")}</text>`,
  )
  const scaleBarMm = scale > 200 ? 0.5 : 1
  const legend = [
    `<text x="20" y="36" ${FONT} font-size="20" font-weight="bold" fill="#e8ecf1">${escapeXml(title)}</text>`,
    `<text x="20" y="58" ${FONT} font-size="13" fill="#8b949e">${visible.length} dangling endpoint${visible.length === 1 ? "" : "s"}. Pours hidden, other layers dimmed.</text>`,
    ...visible.map((entry, index) =>
      legendEntry(entry, layers.get(entry.number)!, 88 + index * 39),
    ),
  ]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PANEL_WIDTH + LEGEND_WIDTH}" height="${PANEL_HEIGHT}" viewBox="0 0 ${PANEL_WIDTH + LEGEND_WIDTH} ${PANEL_HEIGHT}"><rect width="100%" height="100%" fill="#161b22"/>${svg}${rings.join("")}${labelText.join("")}<g transform="translate(24 ${PANEL_HEIGHT - 24})"><path d="M0-6V0H${scaleBarMm * scale}V-6" fill="none" stroke="white" stroke-width="2"/><text y="-12" ${FONT} font-size="14" fill="white">${scaleBarMm} mm</text></g><g transform="translate(${PANEL_WIDTH} 0)">${legend.join("")}</g></svg>`
}

/** Locator map: every dangling endpoint, and the window of each zoomed view. */
export function renderDanglingOverview(
  circuit: AnyCircuitElement[],
  errors: PcbTraceError[],
  windows: Record<string, PcbWindow>,
  title: string,
) {
  const board = circuit.find((element) => element.type === "pcb_board")!
  if (board.type !== "pcb_board") throw new Error("Expected a board")
  const margin = 3
  const boardWindow = {
    minX: board.center.x - board.width! / 2 - margin,
    maxX: board.center.x + board.width! / 2 + margin,
    minY: board.center.y - board.height! / 2 - margin,
    maxY: board.center.y + board.height! / 2 + margin,
  }
  const { svg, toPixels } = renderPanel(
    circuit,
    boardWindow,
    new Set(["top", "bottom"]),
  )
  const windowOutlines = Object.entries(windows).map(([name, window]) => {
    const { x: left, y: bottom } = toPixels({ x: window.minX, y: window.minY })
    const { x: right, y: top } = toPixels({ x: window.maxX, y: window.maxY })
    return `<rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" fill="none" stroke="#39ff14" stroke-width="1.5"/><text x="${left}" y="${top - 4}" ${FONT} font-size="13" font-weight="bold" fill="#39ff14" stroke="black" stroke-width="3" paint-order="stroke">${name}</text>`
  })
  const rings = errors.map(({ center }) => {
    const { x, y } = toPixels(center!)
    return `<circle cx="${x}" cy="${y}" r="3" fill="${MARKER_COLOR}" stroke="black"/>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PANEL_WIDTH}" height="${PANEL_HEIGHT}" viewBox="0 0 ${PANEL_WIDTH} ${PANEL_HEIGHT}"><rect width="100%" height="100%" fill="#0b0d10"/>${svg}${windowOutlines.join("")}${rings.join("")}<text x="20" y="34" ${FONT} font-size="20" font-weight="bold" fill="#e8ecf1">${escapeXml(title)}</text></svg>`
}
