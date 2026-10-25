import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { runAllPlacementChecks as runBeforeFix } from "checks-before-via-pad-placement"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkViasInPads } from "lib/check-vias-in-pads"
import { runAllPlacementChecks } from "lib/run-all-checks"
import { introduceRcCarViaFault } from "../fixtures/rc-car-via-pad-corner/introduce-fault"

const original: AnyCircuitElement[] = JSON.parse(
  readFileSync(
    new URL(
      "../fixtures/rc-car-via-pad-corner/original.circuit.json",
      import.meta.url,
    ),
    "utf8",
  ),
)

test("RC-car control is clean; an intentionally added GND via is missed before the fix and detected after", async () => {
  const unchanged = structuredClone(original)
  expect(await runBeforeFix(structuredClone(original))).toEqual([])
  expect(await runAllPlacementChecks(structuredClone(original))).toEqual([])

  const faulty = introduceRcCarViaFault(original)
  // Preserve the full routed board. Only a GND-connected via and spur are added.
  expect(original).toEqual(unchanged)
  expect(faulty.slice(0, original.length)).toEqual(original)
  expect(faulty).toHaveLength(original.length + 2)
  expect(faulty.filter((element) => element.type === "pcb_via")).toHaveLength(
    14,
  )
  expect(checkViasInPads(faulty)).toEqual([])

  // This is the actual pinned published runner, not a filtered fixed result.
  const before = await runBeforeFix(structuredClone(faulty))
  const after = await runAllPlacementChecks(structuredClone(faulty))
  expect(before).toEqual([])
  expect(after).toHaveLength(1)
  expect(after[0]).toMatchObject({
    type: "pcb_pad_pad_clearance_error",
    pcb_pad_ids: ["pcb_via_intentional_rc_car_fault", "pcb_smtpad_0"],
    actual_clearance: 0,
  })
  expect(after[0].message).toContain("R1.pin1")

  for (const [stage, errors] of [
    ["before", before],
    ["after", after],
  ] as const) {
    const note: AnyCircuitElement = {
      type: "pcb_note_text",
      pcb_note_text_id: `pcb_note_text_intentional_fault_${stage}`,
      text: `INTENTIONAL TEST FAULT / ${stage}: ${errors.length} placement errors`,
      anchor_position: { x: 0, y: -21 },
      anchor_alignment: "center",
      font: "tscircuit2024",
      font_size: 0.7,
      layer: "top",
      color: "yellow",
    }
    await expect(
      convertCircuitJsonToPcbSvg([...faulty, note, ...errors], {
        width: 1200,
        height: 900,
        shouldDrawErrors: true,
        showErrorsInTextOverlay: true,
        showPcbNotes: true,
      }),
    ).toMatchSvgSnapshot(import.meta.path, `rc-car-intentional-fault-${stage}`)
    await expect(
      convertCircuitJsonToPcbSvg([...faulty, ...errors], {
        width: 900,
        height: 700,
        viewport: { minX: 4.5, maxX: 8.7, minY: 8.5, maxY: 12 },
        shouldDrawErrors: true,
        showErrorsInTextOverlay: true,
      }),
    ).toMatchSvgSnapshot(
      import.meta.path,
      `rc-car-intentional-fault-${stage}-zoom`,
    )
  }
})
