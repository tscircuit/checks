import type { AnyCircuitElement, PcbTrace, PcbTraceError } from "circuit-json"

export interface CompactViaSegment {
  start: { x: number; y: number }
  end: { x: number; y: number }
  layer: string
  width: number
}

/** Nonzero board-world copper; authored zero-length via contacts add no segment. */
export function getCompactViaSegments(trace: PcbTrace): CompactViaSegment[] {
  const segments: CompactViaSegment[] = []
  for (let index = 0; index < trace.route.length - 1; index++) {
    const start = trace.route[index]!
    const end = trace.route[index + 1]!
    if (start.route_type === "through_pad" || end.route_type === "through_pad")
      throw new Error("Unexpected through-pad fixture route")
    if (start.x === end.x && start.y === end.y) continue
    const wire = start.route_type === "wire" ? start : end
    if (wire.route_type !== "wire")
      throw new Error("Physical fixture edge must have a wire width")
    segments.push({
      start: { x: start.x, y: start.y },
      end: { x: end.x, y: end.y },
      layer: wire.layer,
      width: wire.width,
    })
  }
  return segments
}

export function getCompactViaContinuitySvg({
  compact,
  control,
  compactErrors,
  controlErrors,
}: {
  compact: AnyCircuitElement[]
  control: AnyCircuitElement[]
  compactErrors: PcbTraceError[]
  controlErrors: PcbTraceError[]
}): string {
  const panels = [
    {
      circuit: compact,
      errors: compactErrors,
      label: "COMPACT: 3 route points",
    },
    {
      circuit: control,
      errors: controlErrors,
      label: "CONTACT CONTROL: 5 route points",
    },
  ]
    .map(({ circuit, errors, label }, panelIndex) => {
      const left = 36 + panelIndex * 596
      const x = (value: number): number => left + 230 + value * 80
      const y = (value: number): number => 405 - value * 80
      const trace = circuit.find((element) => element.type === "pcb_trace")!
      const segments = getCompactViaSegments(trace)
      const copper = segments
        .map(
          (segment) =>
            `<line x1="${x(segment.start.x)}" y1="${y(segment.start.y)}" x2="${x(segment.end.x)}" y2="${y(segment.end.y)}" stroke="${segment.layer === "top" ? "#d86f12" : "#147a91"}" stroke-width="${segment.width * 80}" stroke-linecap="round"/>`,
        )
        .join("")
      const pads = circuit
        .filter((element) => element.type === "pcb_smtpad")
        .map((pad) => {
          if (pad.shape !== "rect")
            throw new Error("Expected real rectangular pads")
          return `<rect x="${x(pad.x - pad.width / 2)}" y="${y(pad.y + pad.height / 2)}" width="${pad.width * 80}" height="${pad.height * 80}" rx="3" fill="#ddd" stroke="#555"/>`
        })
        .join("")
      const via = circuit.find((element) => element.type === "pcb_via")!
      const color = errors.length === 0 ? "#167648" : "#b52935"
      const status =
        errors.length === 0
          ? "ACCEPTED: 0 continuity errors"
          : "FALSE REJECTION: 1 continuity error"
      const marker = errors.length
        ? `<circle cx="${x(via.x)}" cy="${y(via.y)}" r="24" fill="none" stroke="#b52935" stroke-width="3"/><text x="${x(via.x) + 30}" y="${y(via.y) - 12}" fill="#b52935" font-size="15">Reported misaligned</text>`
        : ""
      return `<g><rect x="${left}" y="162" width="558" height="461" rx="8" fill="#fafafa" stroke="#c4c8ce"/><text x="${left + 20}" y="197" font-size="20" font-weight="bold">${label}</text><text x="${left + 20}" y="228" font-size="18" font-weight="bold" fill="${color}">${status}</text>${copper}${pads}<circle cx="${x(via.x)}" cy="${y(via.y)}" r="12" fill="#7357a4"/><circle cx="${x(via.x)}" cy="${y(via.y)}" r="4" fill="white"/>${marker}<text x="${x(0) - 25}" y="${y(-2)}" text-anchor="end" font-size="14">SAVED_START.1</text><text x="${x(2)}" y="${y(1) + 42}" text-anchor="middle" font-size="14">SAVED_END.1</text><text x="${x(0) - 20}" y="${y(-0.5)}" text-anchor="end" fill="#d86f12" font-size="16">TOP: 3 mm</text><text x="${x(1)}" y="${y(1) - 35}" text-anchor="middle" fill="#147a91" font-size="16">BOTTOM: 2 mm</text><text x="${left + 20}" y="601" font-size="15">Barrel spans TOP, INNER1, INNER2, BOTTOM.</text></g>`
    })
    .join("")
  const pass = compactErrors.length === 0 && controlErrors.length === 0
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1228" height="720" viewBox="0 0 1228 720"><rect width="1228" height="720" fill="white"/><g font-family="Arial, sans-serif" fill="#222"><text x="36" y="46" font-size="27" font-weight="bold">${pass ? "AFTER: equivalent compact and expanded copper accepted" : "BEFORE: physically connected compact route rejected"}</text><text x="36" y="82" font-size="19">Both circuits compiled independently from TSX pcbPath; no route points removed.</text><text x="36" y="119" font-size="20" font-weight="bold">Equal physical copper: 5 mm lateral wire + one through-via + two actual pads.</text>${panels}<text x="36" y="661" font-size="17">Projection overlays TOP (orange) and BOTTOM (teal); purple is the emitted four-layer via.</text><text x="36" y="691" font-size="16">Actual checkTracesAreContiguous result: compact ${compactErrors.length} errors; authored contact control ${controlErrors.length} errors.</text></g></svg>`
}
