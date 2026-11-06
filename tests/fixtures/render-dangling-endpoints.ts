import { Point } from "@flatten-js/core"
import { getPourPolygon } from "@tscircuit/circuit-json-util"
import { pointToSegmentDistance } from "@tscircuit/math-utils"
import type { AnyCircuitElement, PcbTrace, PcbTraceError } from "circuit-json"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { getPads, getPadToPadGap } from "lib/check-pad-clearance/common"
import { isPointInPad } from "lib/check-traces-are-contiguous/is-point-in-pad"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"

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

export type ViaReach = {
  /** Gap in mm from the via's ring to the nearest copper off its own route,
   * pours included. Zero or less means contact. */
  clearanceByLayer: { layer: string; clearance: number }[]
  /** Same-net pours on the layers the via spans, nearest first. */
  sameNetPours: { layer: string; clearance: number }[]
}

const buildViaReachContext = (circuit: AnyCircuitElement[]) => {
  const connMap = getFullConnectivityMapFromCircuitJson(circuit)
  const pads = getPads(circuit).map((pad) => ({
    pad,
    layers: getLayersOfPcbElement(pad),
  }))
  const pours = circuit.flatMap((element) =>
    element.type === "pcb_copper_pour"
      ? [
          {
            layer: element.layer as string,
            polygon: getPourPolygon(element),
            netId: element.source_net_id
              ? connMap.getNetConnectedToId(element.source_net_id)
              : undefined,
          },
        ]
      : [],
  )
  const traces = circuit.filter((element) => element.type === "pcb_trace")
  const vias = circuit.filter((element) => element.type === "pcb_via")
  return { connMap, pads, pours, traces, vias }
}

const viaReachContexts = new WeakMap<
  AnyCircuitElement[],
  ReturnType<typeof buildViaReachContext>
>()

/** Measures the copper around a via without using the check's contact code. */
export function getViaReach(
  circuit: AnyCircuitElement[],
  { pcb_trace_id, center }: Pick<PcbTraceError, "pcb_trace_id" | "center">,
): ViaReach {
  let ctx = viaReachContexts.get(circuit)
  if (!ctx) {
    ctx = buildViaReachContext(circuit)
    viaReachContexts.set(circuit, ctx)
  }
  const { connMap, pads, pours, traces, vias } = ctx
  const via = vias.find(
    ({ x, y }) => Math.hypot(x - center!.x, y - center!.y) < 1e-6,
  )
  if (!via) throw new Error("Expected a via at this end")
  const ownTrace = traces.find((trace) => trace.pcb_trace_id === pcb_trace_id)!
  const radius = via.outer_diameter / 2
  const viaLayers = getLayersOfPcbElement(via)
  const netId = connMap.getNetConnectedToId(ownTrace.pcb_trace_id)
  const viaCenter = new Point(via.x, via.y)

  const nearestGapByLayer = new Map<string, number>()
  const addGap = (layer: string, gap: number) => {
    const nearest = nearestGapByLayer.get(layer)
    if (nearest === undefined || gap < nearest) {
      nearestGapByLayer.set(layer, gap)
    }
  }
  for (const trace of traces) {
    if (trace === ownTrace) continue
    for (let i = 1; i < trace.route.length; i++) {
      const start = trace.route[i - 1]!
      const end = trace.route[i]!
      if (start.route_type !== "wire" || end.route_type !== "wire") continue
      if (start.layer !== end.layer) continue
      addGap(
        start.layer,
        pointToSegmentDistance(via, start, end) - radius - start.width / 2,
      )
    }
  }
  for (const other of vias) {
    if (other === via) continue
    const gap =
      Math.hypot(other.x - via.x, other.y - via.y) -
      radius -
      other.outer_diameter / 2
    for (const layer of getLayersOfPcbElement(other)) addGap(layer, gap)
  }
  for (const { pad, layers } of pads) {
    // The pad a route leaves from is where its copper came from, not onward copper.
    const isOwnPad = ownTrace.route.some(
      (point) => "x" in point && isPointInPad(point, pad),
    )
    if (isOwnPad) continue
    const gap = getPadToPadGap(via, pad)
    for (const layer of layers) addGap(layer, gap)
  }

  const sameNetPours: ViaReach["sameNetPours"] = []
  for (const { layer, polygon, netId: pourNetId } of pours) {
    if (!viaLayers.includes(layer)) continue
    const clearance = polygon.contains(viaCenter)
      ? -radius
      : polygon.distanceTo(viaCenter)[0] - radius
    addGap(layer, clearance)
    if (pourNetId && pourNetId === netId) {
      sameNetPours.push({ layer, clearance })
    }
  }

  return {
    clearanceByLayer: viaLayers.map((layer) => ({
      layer,
      clearance: nearestGapByLayer.get(layer) ?? Number.POSITIVE_INFINITY,
    })),
    sameNetPours: sameNetPours.sort((a, b) => a.clearance - b.clearance),
  }
}

const LEGEND_LINE_HEIGHT = 17
const LEGEND_ENTRY_GAP = 5

const legendEntry = (
  { number, error }: NumberedError,
  description: string[],
  y: number,
) => {
  const name = error.message.match(/\[(.*)\]/)?.[1] ?? error.pcb_trace_id
  return (
    `<text x="20" y="${y}" ${FONT} font-size="15" fill="#e8ecf1"><tspan fill="${MARKER_COLOR}" font-weight="bold">${number}</tspan> ${escapeXml(name ?? "")}</text>` +
    description
      .map(
        (line, index) =>
          `<text x="20" y="${y + (index + 1) * LEGEND_LINE_HEIGHT}" ${FONT} font-size="13" fill="#8b949e">${line}</text>`,
      )
      .join("")
  )
}

const describeEndpoint = (
  circuit: AnyCircuitElement[],
  error: PcbTraceError,
  layer: string,
) => {
  const location = `(${error.center!.x.toFixed(2)}, ${error.center!.y.toFixed(2)})`
  if (layer !== "via") return [`free end on ${layer} at ${location}`]
  const { clearanceByLayer, sameNetPours } = getViaReach(circuit, error)
  const nearestPour = sameNetPours[0]
  return [
    `via going nowhere at ${location}`,
    `clearance (mm): ${clearanceByLayer
      .map(
        ({ layer, clearance }) =>
          `${layer} ${clearance <= 0 ? "touching" : clearance.toFixed(2)}`,
      )
      .join(", ")}`,
    nearestPour
      ? `same-net pour: ${nearestPour.clearance.toFixed(2)} mm away on ${nearestPour.layer}`
      : "same-net pour: none on this net",
  ]
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
  const count = `${visible.length} dangling endpoint${visible.length === 1 ? "" : "s"}.`
  // A via spans every layer, so a view with a via end dims none of them.
  const caption = [...layers.values()].includes("via")
    ? [
        `${count} Pours hidden, all layers at full strength.`,
        "Via rings are drawn in the top-layer color on every layer.",
        "Clearance: ring to copper off the via's route, hidden pours included.",
      ]
    : [`${count} Pours hidden, other layers dimmed.`]
  const legend = [
    `<text x="20" y="36" ${FONT} font-size="20" font-weight="bold" fill="#e8ecf1">${escapeXml(title)}</text>`,
    ...caption.map(
      (line, index) =>
        `<text x="20" y="${58 + index * LEGEND_LINE_HEIGHT}" ${FONT} font-size="13" fill="#8b949e">${line}</text>`,
    ),
  ]
  let entryY = 88 + (caption.length - 1) * LEGEND_LINE_HEIGHT
  for (const entry of visible) {
    const description = describeEndpoint(
      circuit,
      entry.error,
      layers.get(entry.number)!,
    )
    legend.push(legendEntry(entry, description, entryY))
    entryY += (description.length + 1) * LEGEND_LINE_HEIGHT + LEGEND_ENTRY_GAP
  }
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
