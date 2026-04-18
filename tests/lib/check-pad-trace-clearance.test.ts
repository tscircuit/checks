import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkPadTraceClearance } from "../../lib/check-pad-trace-clearance"

test("checkPadTraceClearance reports pad and trace closer than 0.2mm", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      shape: "rect",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace1",
      route: [
        { route_type: "wire", x: -1, y: 0.625, width: 0.1, layer: "top" },
        { route_type: "wire", x: 1, y: 0.625, width: 0.1, layer: "top" },
      ],
    },
  ]

  const errors = checkPadTraceClearance(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0].type).toBe("pcb_pad_trace_clearance_error")
  expect(errors[0].pcb_pad_id).toBe("pad1")
  expect(errors[0].pcb_trace_id).toBe("trace1")
  expect(errors[0].minimum_clearance).toBe(0.1)
  expect(errors[0].actual_clearance).toBeCloseTo(0.075, 10)
})

test("checkPadTraceClearance deduplicates multiple close segments for one pad-trace pair", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "pcb_smtpad",
      pcb_smtpad_id: "pad1",
      shape: "rect",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      layer: "top",
    },
    {
      type: "pcb_trace",
      pcb_trace_id: "trace1",
      route: [
        { route_type: "wire", x: -1, y: 0.69, width: 0.1, layer: "top" },
        { route_type: "wire", x: 1, y: 0.69, width: 0.1, layer: "top" },
        { route_type: "wire", x: 1, y: 0.625, width: 0.1, layer: "top" },
        { route_type: "wire", x: -1, y: 0.625, width: 0.1, layer: "top" },
      ],
    },
  ]

  const errors = checkPadTraceClearance(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_pad_id).toBe("pad1")
  expect(errors[0].pcb_trace_id).toBe("trace1")
  expect(errors[0].actual_clearance).toBeCloseTo(0.075, 10)
})
