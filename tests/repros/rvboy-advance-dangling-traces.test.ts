import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import type { AnyCircuitElement } from "circuit-json"
import { checkDanglingTraces } from "../../lib/check-dangling-traces/check-dangling-traces"
import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { isPointInPad } from "../../lib/check-traces-are-contiguous/is-point-in-pad"
import {
  type PcbWindow,
  renderDanglingEndpoints,
  renderDanglingOverview,
} from "../fixtures/render-dangling-endpoints"

const BOARD_NAME = "seveibar/rvboy-advance v0.8.0"
const TEST_TIMEOUT_MS = 120_000

const originalJson = gunzipSync(
  readFileSync(
    new URL("../assets/rvboy-advance-v0.8.0.circuit.json.gz", import.meta.url),
  ),
)
const circuit = JSON.parse(originalJson.toString()) as AnyCircuitElement[]

// One window per group of dead ends, chosen from an audit of the copper that
// does not use this repo's checks. See tests/assets/rvboy-advance-v0.8.0.md.
const WINDOWS: Record<string, PcbWindow> = {
  S01: { minX: 0.58, maxX: 12.88, minY: 24.23, maxY: 33.45 },
  // Detail of S01: 0.06 mm fragments with a free end on each side.
  S01_fragments: { minX: 5.9, maxX: 7.1, minY: 27.65, maxY: 29.25 },
  S02: { minX: 21.5, maxX: 24.95, minY: -21.08, maxY: -18.49 },
  S03: { minX: 34.02, maxX: 37.47, minY: -1.34, maxY: 1.25 },
  S04: { minX: 28.35, maxX: 31.81, minY: -1.25, maxY: 1.35 },
  S05: { minX: 24.63, maxX: 32.22, minY: 6.24, maxY: 11.94 },
  S06: { minX: -17.95, maxX: -14.5, minY: 7.48, maxY: 10.07 },
  S07: { minX: 48.22, maxX: 52.67, minY: 27.84, maxY: 31.18 },
  S08: { minX: 47.38, maxX: 50.83, minY: 32.49, maxY: 35.08 },
  S09: { minX: -43.88, maxX: -40.43, minY: 10.94, maxY: 13.53 },
  S10: { minX: -20.71, maxX: -8.5, minY: 20.75, maxY: 29.91 },
  S11: { minX: 26.93, maxX: 31.03, minY: 20.19, maxY: 23.27 },
  S12: { minX: -7.53, maxX: -2.15, minY: 5.38, maxY: 9.42 },
  S13: { minX: -20.28, maxX: -16.82, minY: 22.91, maxY: 25.5 },
  S14: { minX: -0.43, maxX: 7.66, minY: 13.55, maxY: 19.62 },
  S15: { minX: -52.97, maxX: -49.51, minY: 32.12, maxY: 34.71 },
  S16: { minX: 18.6, maxX: 22.05, minY: -28.43, maxY: -25.84 },
  S17: { minX: -40.6, maxX: -37.14, minY: 13.09, maxY: 15.68 },
  S18: { minX: 38.01, maxX: 43.33, minY: 3.62, maxY: 7.61 },
  S19: { minX: 27.88, maxX: 31.34, minY: 10.74, maxY: 13.34 },
  S20: { minX: -22.48, maxX: -19.02, minY: 29.3, maxY: 31.9 },
  S21: { minX: 47.47, maxX: 50.92, minY: 12.21, maxY: 14.8 },
  S22: { minX: 5.26, maxX: 8.72, minY: 4.5, maxY: 7.1 },
  S23: { minX: 28.21, maxX: 31.66, minY: 14.2, maxY: 16.8 },
  S24: { minX: 47.24, maxX: 51.15, minY: 17.03, maxY: 19.96 },
  S25: { minX: -57.11, maxX: -53.65, minY: 18.45, maxY: 21.05 },
  S26: { minX: 5.97, maxX: 9.42, minY: 14.85, maxY: 17.44 },
  S27: { minX: -21.38, maxX: -17.92, minY: 10.54, maxY: 13.13 },
}

const isInside = (
  window: PcbWindow,
  point: { x: number; y: number },
  inset = 0,
) =>
  point.x >= window.minX + inset &&
  point.x <= window.maxX - inset &&
  point.y >= window.minY + inset &&
  point.y <= window.maxY - inset

test("rvboy-advance fixture has the polygon pads that used to hide its dead ends", () => {
  expect(createHash("sha256").update(originalJson).digest("hex")).toBe(
    "c661fa9ed23eae246d829a721917dada25332354140b705536ca1ea47dfcccda",
  )
  const padsWithZeroLengthEdges = circuit.filter(
    (element) =>
      element.type === "pcb_smtpad" &&
      element.shape === "polygon" &&
      element.points.some((point, index) => {
        const next = element.points[(index + 1) % element.points.length]!
        return Math.hypot(point.x - next.x, point.y - next.y) < 1e-6
      }),
  )
  expect(padsWithZeroLengthEdges.length).toBeGreaterThan(0)
  for (const pad of padsWithZeroLengthEdges) {
    expect(isPointInPad({ x: 1000, y: 1000 }, pad as any)).toBe(false)
  }
})

test(
  "rvboy-advance: reports every dead end and no false opens",
  async () => {
    const errors = checkDanglingTraces(circuit)
    expect(errors).toHaveLength(60)
    expect(errors.map(({ message }) => message)).toMatchSnapshot()

    // All nets on this board are connected. Only dead copper is wrong with it.
    expect(checkTracesAreContiguous(circuit)).toEqual([])

    // Each end has a zoomed view where its marker is fully on screen, and no
    // view is left over from an end that is no longer reported.
    const endsWithoutAView = errors.filter(
      ({ center }) =>
        !Object.values(WINDOWS).some((window) =>
          isInside(window, center!, 0.1),
        ),
    )
    expect(endsWithoutAView.map(({ message }) => message)).toEqual([])
    const viewsWithoutAnEnd = Object.keys(WINDOWS).filter(
      (name) => !errors.some(({ center }) => isInside(WINDOWS[name]!, center!)),
    )
    expect(viewsWithoutAnEnd).toEqual([])

    await expect(
      renderDanglingOverview(
        circuit,
        errors,
        WINDOWS,
        `${BOARD_NAME}: ${errors.length} dangling endpoints`,
      ),
    ).toMatchSvgSnapshot(import.meta.path)
    const names = Object.keys(WINDOWS)
    await expect(
      names.map((name) =>
        renderDanglingEndpoints(
          circuit,
          errors,
          WINDOWS[name]!,
          `${name.replace("_", " ")} · ${BOARD_NAME}`,
        ),
      ),
    ).toMatchMultipleSvgSnapshots(
      import.meta.path,
      names.map((name) => `rvboy-advance-dangling-${name}`),
    )
  },
  TEST_TIMEOUT_MS,
)
