import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace, PcbVia } from "circuit-json"
import { checkHoleTraceClearance, runAllRoutingChecks } from "../../index"

// Repro tscircuit/checks#501 (NIATOLIP #29 B2) : un trou de via ignoré par
// getHoleGeometries rend checkHoleTraceClearance aveugle aux violations
// via↔piste que kicad-cli pcb drc signale en hole_clearance (JLCPCB 0,2 mm).
test("trace-to-via-hole clearance flags via drill holes like pcb_hole", async () => {
  const via: PcbVia = {
    type: "pcb_via",
    pcb_via_id: "via",
    x: 0,
    y: 0,
    hole_diameter: 0.6,
    outer_diameter: 1.0,
    layers: ["top", "bottom"],
  }
  // Trou r=0,3 ; piste largeur 0,2 à y=0,55 → cuivre à 0,45 → gap 0,15 < 0,2.
  const close: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "close",
    source_trace_id: "source",
    route: [
      { route_type: "wire", x: -3, y: 0.55, width: 0.2, layer: "top" },
      { route_type: "wire", x: 3, y: 0.55, width: 0.2, layer: "top" },
    ],
  }
  // Même piste à y=0,7 → cuivre à 0,6 → gap 0,3 ≥ 0,2 : verte.
  const far: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "far",
    source_trace_id: "source",
    route: [
      { route_type: "wire", x: -3, y: 0.7, width: 0.2, layer: "top" },
      { route_type: "wire", x: 3, y: 0.7, width: 0.2, layer: "top" },
    ],
  }
  const circuit: AnyCircuitElement[] = [via, close, far]
  const errors = checkHoleTraceClearance(circuit)
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({ pcb_trace_id: "close" })
  // runAllRoutingChecks (gate G3 NIATOLIP) doit remonter la violation
  // (le même segment déclenche aussi un overlap préexistant de même id
  // `overlap_close_via` — on discrimine par le message de clearance).
  const routingErrors = await runAllRoutingChecks(circuit)
  expect(
    routingErrors.filter(
      (error) =>
        error.type === "pcb_trace_error" &&
        error.pcb_trace_id === "close" &&
        error.message.includes("too close to hole"),
    ),
  ).toHaveLength(1)
})
