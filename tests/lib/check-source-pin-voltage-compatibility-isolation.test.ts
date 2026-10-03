import { expect, test } from "bun:test"
import { checkSourcePinVoltageCompatibility } from "../.."
import { voltageCompatibilityFixture } from "../fixtures/voltage-compatibility"

test("disconnected pins and separate nets with the same name do not cause voltage errors", () => {
  const circuitJson = voltageCompatibilityFixture()
  for (const element of circuitJson) {
    if (
      element.type === "source_trace" &&
      element.source_trace_id === "source_trace_consumer"
    ) {
      element.connected_source_net_ids = ["source_net_separate_avcc"]
    }
  }
  for (const sourceNetId of ["source_net_avcc", "source_net_separate_avcc"]) {
    circuitJson.push({
      type: "source_net",
      source_net_id: sourceNetId,
      name: "AVCC",
      member_source_group_ids: [],
    })
  }
  expect(checkSourcePinVoltageCompatibility(circuitJson)).toEqual([])
  expect(
    checkSourcePinVoltageCompatibility(
      circuitJson.filter((element) => element.type !== "source_trace"),
    ),
  ).toEqual([])
})
