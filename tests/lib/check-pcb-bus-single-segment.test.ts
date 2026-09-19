import { expect, test } from "bun:test"
import { any_circuit_element, type PcbTrace } from "circuit-json"
import { checkPcbBusLengthSkew } from "../../lib/check-pcb-bus-length-skew"
import { bus, trace } from "../fixtures/length-matching"

const throughPad = (): PcbTrace => ({
  ...trace("a", 0),
  trace_length: undefined,
  route: [
    {
      route_type: "through_pad",
      start: { x: 0, y: 0 },
      end: { x: 2, y: 0 },
      start_layer: "top",
      end_layer: "top",
      width: 1,
    },
  ],
})

test("includes a single through-pad segment when comparing bus lengths", () => {
  const segment = throughPad()
  expect(any_circuit_element.safeParse(segment).success).toBe(true)
  expect(checkPcbBusLengthSkew([bus(), segment, trace("b", 10)])).toEqual([
    expect.objectContaining({
      actual_length_skew: 8,
      source_trace_ids: ["a", "b"],
      pcb_trace_ids: ["pcb_a", "pcb_b"],
    }),
  ])
})

test("includes a single via's depth when comparing bus lengths", () => {
  const via: PcbTrace = {
    ...trace("a", 0),
    trace_length: undefined,
    route: [
      {
        route_type: "via",
        x: 0,
        y: 0,
        from_layer: "top",
        to_layer: "bottom",
      },
    ],
  }
  expect(any_circuit_element.safeParse(via).success).toBe(true)
  const errors = checkPcbBusLengthSkew([bus(), via, trace("b", 10)])
  expect(errors).toHaveLength(1)
  expect(errors[0]?.actual_length_skew).toBeCloseTo(8.4)
})

test("includes through-pad fragments in a member's total length", () => {
  expect(
    checkPcbBusLengthSkew([
      bus(0),
      throughPad(),
      { ...trace("a", 8), pcb_trace_id: "pcb_a_fragment" },
      trace("b", 10),
    ]),
  ).toEqual([])
})

test("still skips an isolated wire point with no routed segment", () => {
  const point: PcbTrace = {
    ...trace("a", 0),
    trace_length: undefined,
    route: [{ route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" }],
  }
  expect(checkPcbBusLengthSkew([bus(), point, trace("b", 10)])).toEqual([])
})

test("honors a provided length even for a single through-pad segment", () => {
  expect(
    checkPcbBusLengthSkew([
      bus(0),
      { ...throughPad(), trace_length: 10 },
      trace("b", 10),
    ]),
  ).toEqual([])
})
