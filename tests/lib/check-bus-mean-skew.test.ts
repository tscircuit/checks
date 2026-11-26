import { expect, test } from "bun:test"
import { checkPcbBusLengthSkew } from "../../lib/check-pcb-bus-length-skew"
import { getBusLengthSkew } from "../../lib/util/get-bus-length-skew"
import type { AnyCircuitElement } from "circuit-json"

test("mean skew uses every measured member rather than half the range", () => {
  const lengths = [10, 10, 14]
  expect(getBusLengthSkew({ lengths })).toBe(4)
  expect(getBusLengthSkew({ lengths, reference: "mean" })).toBeCloseTo(8 / 3)
  const input: AnyCircuitElement[] = [
    {
      type: "source_bus",
      source_bus_id: "bus_1",
      source_trace_ids: ["a", "b", "c"],
      max_length_skew: 2.5,
      length_skew_reference: "mean",
    },
    ...lengths.map((length, index) => ({
      type: "pcb_trace" as const,
      pcb_trace_id: `pcb_${index}`,
      source_trace_id: ["a", "b", "c"][index],
      trace_length: length,
      route: [],
    })),
  ]
  const [finding] = checkPcbBusLengthSkew(input)
  expect(finding.actual_length_skew).toBeCloseTo(8 / 3)
})
