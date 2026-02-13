import type {
  AnyCircuitElement,
  PcbFootprintOverlapError,
  PcbSmtPad,
  PcbPlatedHole,
  PcbHole,
  PcbComponent,
} from "circuit-json"
import {
  cju,
  getBoundsOfPcbElements,
  getPrimaryId,
} from "@tscircuit/circuit-json-util"
import { getReadableNameForElementId } from "lib/util/get-readable-names"
import { doBoundsOverlap } from "@tscircuit/math-utils"
import {
  getFullConnectivityMapFromCircuitJson,
  type ConnectivityMap,
} from "circuit-json-to-connectivity-map"

type OverlappableElement = PcbSmtPad | PcbPlatedHole | PcbHole

interface ComponentWithElements {
  component_id: string
  elements: OverlappableElement[]
  bounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
}

/**
 * Check if two PCB elements overlap
 * Currently uses simple bounds overlap, but can be extended to handle
 * more precise overlap detection for rotated rects, pills, circles, etc.
 */
function doPcbElementsOverlap(
  elem1: OverlappableElement,
  elem2: OverlappableElement,
): boolean {
  const bounds1 = getBoundsOfPcbElements([elem1])
  const bounds2 = getBoundsOfPcbElements([elem2])
  return doBoundsOverlap(bounds1, bounds2)
}

/**
 * Check for overlapping PCB components
 * Returns errors for components that overlap inappropriately
 */
export function checkPcbComponentOverlap(
  circuitJson: AnyCircuitElement[],
): PcbFootprintOverlapError[] {
  const errors: PcbFootprintOverlapError[] = []

  // Build connectivity map to check if components are electrically connected
  const connMap = getFullConnectivityMapFromCircuitJson(circuitJson)

  // Get all overlappable elements
  const smtPads = cju(circuitJson).pcb_smtpad.list()
  const platedHoles = cju(circuitJson).pcb_plated_hole.list()
  const holes = cju(circuitJson).pcb_hole.list()

  // Group elements by component (or treat standalone elements as their own "component")
  const componentMap = new Map<string, ComponentWithElements>()

  // Group SMT pads by component (or treat as standalone)
  for (const pad of smtPads) {
    const componentId =
      pad.pcb_component_id || `standalone_pad_${getPrimaryId(pad)}`
    if (!componentMap.has(componentId)) {
      componentMap.set(componentId, {
        component_id: componentId,
        elements: [],
        bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      })
    }
    componentMap.get(componentId)!.elements.push(pad)
  }

  // Group plated holes by component (or treat as standalone)
  for (const hole of platedHoles) {
    const componentId =
      hole.pcb_component_id || `standalone_plated_hole_${getPrimaryId(hole)}`
    if (!componentMap.has(componentId)) {
      componentMap.set(componentId, {
        component_id: componentId,
        elements: [],
        bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      })
    }
    componentMap.get(componentId)!.elements.push(hole)
  }

  // Holes typically don't have pcb_component_id, treat each as standalone
  for (const hole of holes) {
    const componentId = `standalone_hole_${getPrimaryId(hole)}`
    componentMap.set(componentId, {
      component_id: componentId,
      elements: [hole],
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    })
  }

  // Compute bounds for each component
  for (const [componentId, componentData] of componentMap) {
    if (componentData.elements.length > 0) {
      componentData.bounds = getBoundsOfPcbElements(componentData.elements)
    }
  }

  // Convert map to array for pairwise iteration
  const componentsWithElements = Array.from(componentMap.values())

  // Pairwise check: only check elements if component bounds overlap
  for (let i = 0; i < componentsWithElements.length; i++) {
    for (let j = i + 1; j < componentsWithElements.length; j++) {
      const comp1 = componentsWithElements[i]
      const comp2 = componentsWithElements[j]

      // First check if component bounds overlap
      if (!doBoundsOverlap(comp1.bounds, comp2.bounds)) {
        continue
      }

      // Component bounds overlap, now check individual elements
      for (const elem1 of comp1.elements) {
        for (const elem2 of comp2.elements) {
          const id1 = getPrimaryId(elem1)
          const id2 = getPrimaryId(elem2)

          // Check if both are SMT pads and are electrically connected (same net) - if so, skip
          // This allows pads with the same subcircuit connectivity to be in contact
          if (
            elem1.type === "pcb_smtpad" &&
            elem2.type === "pcb_smtpad" &&
            connMap.areIdsConnected(id1, id2)
          ) {
            continue
          }

          // Check if element bounds overlap
          if (doPcbElementsOverlap(elem1, elem2)) {
            // Create error object
            const error: PcbFootprintOverlapError = {
              type: "pcb_footprint_overlap_error",
              pcb_error_id: `pcb_footprint_overlap_${id1}_${id2}`,
              error_type: "pcb_footprint_overlap_error",
              message: `${elem1.type} ${getReadableNameForElementId(circuitJson, id1)} overlaps with ${elem2.type} ${getReadableNameForElementId(circuitJson, id2)}`,
            }

            // Add relevant IDs based on element types
            if (elem1.type === "pcb_smtpad" || elem2.type === "pcb_smtpad") {
              error.pcb_smtpad_ids = []
              if (elem1.type === "pcb_smtpad") error.pcb_smtpad_ids.push(id1)
              if (elem2.type === "pcb_smtpad") error.pcb_smtpad_ids.push(id2)
            }

            if (
              elem1.type === "pcb_plated_hole" ||
              elem2.type === "pcb_plated_hole"
            ) {
              error.pcb_plated_hole_ids = []
              if (elem1.type === "pcb_plated_hole")
                error.pcb_plated_hole_ids.push(id1)
              if (elem2.type === "pcb_plated_hole")
                error.pcb_plated_hole_ids.push(id2)
            }

            if (elem1.type === "pcb_hole" || elem2.type === "pcb_hole") {
              error.pcb_hole_ids = []
              if (elem1.type === "pcb_hole") error.pcb_hole_ids.push(id1)
              if (elem2.type === "pcb_hole") error.pcb_hole_ids.push(id2)
            }

            errors.push(error)
          }
        }
      }
    }
  }

  return errors
}
