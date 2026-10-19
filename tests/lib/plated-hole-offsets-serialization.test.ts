import { expect, test } from "bun:test"
import { runAllRoutingChecks } from "lib/run-all-checks"
import { undefinedPlatedHoleOffsetsFixture } from "../fixtures/undefined-plated-hole-offsets"

test("serialized plated-hole offsets do not abort routing DRC", async () => {
  const circuitJson = await undefinedPlatedHoleOffsetsFixture()
  // Serialization removes the undefined properties, masking the bug.
  expect(
    await runAllRoutingChecks(JSON.parse(JSON.stringify(circuitJson))),
  ).toEqual([])
})
