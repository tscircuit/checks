import { expect, test } from "bun:test"
import { runAllRoutingChecks } from "lib/run-all-checks"
import { undefinedPlatedHoleOffsetsFixture } from "../fixtures/undefined-plated-hole-offsets"

test("routing DRC defaults each undefined plated-hole offset without mutating the hole", async () => {
  for (const offsets of [
    { hole_offset_x: undefined, hole_offset_y: 0 },
    { hole_offset_x: 0, hole_offset_y: undefined },
    { hole_offset_x: 0, hole_offset_y: 0 },
  ]) {
    const circuitJson = await undefinedPlatedHoleOffsetsFixture()
    const hole = circuitJson.find(
      (element) =>
        element.type === "pcb_plated_hole" &&
        element.shape === "circular_hole_with_rect_pad",
    )!
    Object.assign(hole, offsets)
    const originalHole = structuredClone(hole)
    expect(await runAllRoutingChecks(circuitJson)).toEqual([])
    expect(hole).toEqual(originalHole)
  }
})
