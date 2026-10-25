import { BooleanOperations, ORIENTATION } from "@flatten-js/core"
import { convertCircuitJsonToFlattenJs } from "@tscircuit/circuit-json-to-flattenjs"
import type { AnyCircuitElement } from "circuit-json"
import type { OverlappableElement } from "./doPcbElementsOverlap"

const CURVE_TOLERANCE_MM = 1e-6
const GEOMETRY_EPSILON_MM2 = 1e-12

export function canSameNetPadsOverlap(
  { elem1, elem2 }: { elem1: OverlappableElement; elem2: OverlappableElement },
  circuitJson: AnyCircuitElement[],
): boolean {
  if (elem1.type === "pcb_plated_hole" && elem2.type === "pcb_smtpad") {
    return canSameNetPadsOverlap({ elem1: elem2, elem2: elem1 }, circuitJson)
  }
  if (elem1.type !== "pcb_smtpad") return false
  if (elem2.type === "pcb_smtpad") return true
  if (elem2.type !== "pcb_plated_hole") return false

  const { elements } = convertCircuitJsonToFlattenJs(circuitJson, {
    elementIds: [elem1.pcb_smtpad_id, elem2.pcb_plated_hole_id],
    layer: elem1.layer,
    includeDrillHoles: true,
    curveTolerance: CURVE_TOLERANCE_MM,
    strict: true,
  })
  const pad = elements.find(
    (element) => element.elementId === elem1.pcb_smtpad_id,
  )
  const platedHole = elements.find(
    (element) => element.elementId === elem2.pcb_plated_hole_id,
  )
  if (!pad || !platedHole) return false

  // Oppositely wound faces are the physical drills, including offsets and slots.
  for (const copper of platedHole.shapes) {
    for (const drill of copper.toArray()) {
      if (drill.orientation() === copper.orientation()) continue
      if (drill.orientation() === ORIENTATION.CW) drill.reverse()
      for (const shape of pad.shapes) {
        if (shape.orientation() === ORIENTATION.CW) shape.reverse()
        if (
          BooleanOperations.intersect(shape, drill).area() >
          GEOMETRY_EPSILON_MM2
        )
          return false
      }
    }
  }
  return true
}
