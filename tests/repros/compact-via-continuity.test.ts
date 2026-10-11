import { expect, test } from "bun:test"
import { readFileSync, writeFileSync } from "node:fs"
import { Resvg } from "@resvg/resvg-js"
import { checkTracesAreContiguous } from "lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { renderCompactViaContinuity } from "../fixtures/compact-via-continuity"
import {
  getCompactViaSegments,
  getCompactViaContinuitySvg,
} from "../fixtures/compact-via-continuity-visual"

test("Core compact via route has the same copper as its accepted contact control", async (): Promise<void> => {
  const compact = await renderCompactViaContinuity()
  const control = await renderCompactViaContinuity({ explicitContacts: true })
  const original = structuredClone(compact)
  const compactTrace = compact.find((element) => element.type === "pcb_trace")!
  const controlTrace = control.find((element) => element.type === "pcb_trace")!
  expect(
    compact.find((element) => element.type === "pcb_board")!.num_layers,
  ).toBe(4)
  expect(compactTrace.route.map((point) => point.route_type)).toEqual([
    "wire",
    "via",
    "wire",
  ])
  expect(controlTrace.route.map((point) => point.route_type)).toEqual([
    "wire",
    "wire",
    "via",
    "wire",
    "wire",
  ])
  expect(getCompactViaSegments(compactTrace)).toEqual(
    getCompactViaSegments(controlTrace),
  )
  expect(getCompactViaSegments(compactTrace)).toEqual([
    { start: { x: 0, y: -2 }, end: { x: 0, y: 1 }, layer: "top", width: 0.2 },
    { start: { x: 0, y: 1 }, end: { x: 2, y: 1 }, layer: "bottom", width: 0.2 },
  ])
  expect(compact.filter((element) => element.type === "pcb_via")).toEqual(
    control.filter((element) => element.type === "pcb_via"),
  )
  const compactErrors = checkTracesAreContiguous(compact)
  const controlErrors = checkTracesAreContiguous(control)
  expect(compactErrors).toHaveLength(1)
  expect(compactErrors[0]).toMatchObject({
    pcb_trace_error_id: "misaligned_via_pcb_trace_0_1",
    message:
      "Via in trace [SAVED_START.1 to SAVED_END.1] is misaligned at position {x: 0, y: 1}.",
  })
  expect(controlErrors).toEqual([])
  expect(compact).toEqual(original)
  const svg = getCompactViaContinuitySvg({
    compact,
    control,
    compactErrors,
    controlErrors,
  })
  const snapshot = new URL(
    "./__snapshots__/compact-via-continuity.before.svg",
    import.meta.url,
  )
  if (process.env.UPDATE_COMPACT_VIA_SNAPSHOTS === "1") {
    writeFileSync(snapshot, svg)
    writeFileSync(
      new URL(
        "./__snapshots__/compact-via-continuity.before.png",
        import.meta.url,
      ),
      new Uint8Array(new Resvg(svg).render().asPng()),
    )
  }
  expect(svg).toBe(readFileSync(snapshot, "utf8"))
})
