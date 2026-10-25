import type { AnyCircuitElement } from "circuit-json"

// INTENTIONAL TEST FAULT. The published RC-car board does not have this short.
// Add one GND via and a bottom-layer spur; retain every original record verbatim.
export function introduceRcCarViaFault(original: AnyCircuitElement[]) {
  const groundVia = original.find(
    (element) =>
      element.type === "pcb_via" && element.pcb_via_id === "pcb_via_10",
  )
  const groundTrace = original.find(
    (element) =>
      element.type === "pcb_trace" &&
      groundVia?.type === "pcb_via" &&
      element.pcb_trace_id === groundVia.pcb_trace_id,
  )
  if (groundVia?.type !== "pcb_via" || groundTrace?.type !== "pcb_trace") {
    throw new Error("RC-car fixture is missing its original GND landing")
  }
  const point = { x: 5.4, y: 10.875 }
  const viaId = "pcb_via_intentional_rc_car_fault"
  const traceId = "pcb_trace_intentional_rc_car_ground_spur"
  const added: AnyCircuitElement[] = [
    {
      ...groundVia,
      pcb_via_id: viaId,
      pcb_trace_id: traceId,
      ...point,
      hole_diameter: 0.3,
      outer_diameter: 0.6,
      from_layer: "bottom",
      to_layer: "top",
    },
    {
      ...groundTrace,
      pcb_trace_id: traceId,
      route: [
        {
          route_type: "wire",
          x: groundVia.x,
          y: groundVia.y,
          width: 0.3,
          layer: "bottom",
        },
        { route_type: "wire", ...point, width: 0.3, layer: "bottom" },
      ],
    },
  ]
  return [...structuredClone(original), ...added]
}
