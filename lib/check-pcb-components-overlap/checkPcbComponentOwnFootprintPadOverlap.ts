import {
  cju,
  getBoundsOfPcbElements,
  getPrimaryId,
} from "@tscircuit/circuit-json-util"
import { doBoundsOverlap } from "@tscircuit/math-utils"
import type {
  AnyCircuitElement,
  PcbFootprintOverlapError,
  PcbPlatedHole,
  PcbSmtPad,
} from "circuit-json"
import {
  getReadableNameForComponent,
  getReadableNameForPort,
} from "lib/util/get-readable-names"

type FootprintPad = PcbSmtPad | PcbPlatedHole

function formatPadReference(
  circuitJson: AnyCircuitElement[],
  pad: FootprintPad,
  ordinal: number,
): string {
  const padKind = pad.type === "pcb_smtpad" ? "SMD pad" : "through-hole pad"
  const portRef = pad.pcb_port_id
    ? getReadableNameForPort(circuitJson, pad.pcb_port_id)
    : null
  const bounds = getBoundsOfPcbElements([pad])
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  const location = `(${centerX.toFixed(2)}mm, ${centerY.toFixed(2)}mm)`

  if (portRef) return `${padKind} ${portRef} at ${location}`
  return `${padKind} #${ordinal + 1} at ${location}`
}

function doPcbPadsOverlap(pad1: FootprintPad, pad2: FootprintPad): boolean {
  const bounds1 = getBoundsOfPcbElements([pad1])
  const bounds2 = getBoundsOfPcbElements([pad2])
  return doBoundsOverlap(bounds1, bounds2)
}

/**
 * Checks for overlapping pads that belong to the same pcb_component.
 */
export function checkPcbComponentOwnFootprintPadOverlap(
  circuitJson: AnyCircuitElement[],
): PcbFootprintOverlapError[] {
  const errors: PcbFootprintOverlapError[] = []
  const smtPads = cju(circuitJson).pcb_smtpad.list()
  const platedHoles = cju(circuitJson).pcb_plated_hole.list()
  const padsByComponent = new Map<string, FootprintPad[]>()

  for (const pad of smtPads) {
    if (!pad.pcb_component_id) continue
    if (!padsByComponent.has(pad.pcb_component_id)) {
      padsByComponent.set(pad.pcb_component_id, [])
    }
    padsByComponent.get(pad.pcb_component_id)!.push(pad)
  }

  for (const platedHole of platedHoles) {
    if (!platedHole.pcb_component_id) continue
    if (!padsByComponent.has(platedHole.pcb_component_id)) {
      padsByComponent.set(platedHole.pcb_component_id, [])
    }
    padsByComponent.get(platedHole.pcb_component_id)!.push(platedHole)
  }

  for (const [componentId, pads] of padsByComponent) {
    let overlapFoundInComponent = false
    for (let i = 0; i < pads.length; i++) {
      for (let j = i + 1; j < pads.length; j++) {
        const pad1 = pads[i]
        const pad2 = pads[j]

        if (!doPcbPadsOverlap(pad1, pad2)) continue

        const pad1Id = getPrimaryId(pad1)
        const pad2Id = getPrimaryId(pad2)
        const componentName = getReadableNameForComponent(
          circuitJson,
          componentId,
        )
        const pad1Ref = formatPadReference(circuitJson, pad1, i)
        const pad2Ref = formatPadReference(circuitJson, pad2, j)

        const error: PcbFootprintOverlapError = {
          type: "pcb_footprint_overlap_error",
          pcb_error_id: `pcb_component_self_overlap_${componentId}_${pad1Id}_${pad2Id}`,
          error_type: "pcb_footprint_overlap_error",
          message: `${pad1Ref} overlaps ${pad2Ref} in ${componentName}; adjust footprint pad positions/sizes so copper pads do not intersect; you can also use the footprint string to adjust the pad positions/sizes`,
        }

        const smtPadIds = [pad1, pad2]
          .filter((pad) => pad.type === "pcb_smtpad")
          .map((pad) => getPrimaryId(pad))
        if (smtPadIds.length > 0) {
          error.pcb_smtpad_ids = smtPadIds
        }

        const platedHoleIds = [pad1, pad2]
          .filter((pad) => pad.type === "pcb_plated_hole")
          .map((pad) => getPrimaryId(pad))
        if (platedHoleIds.length > 0) {
          error.pcb_plated_hole_ids = platedHoleIds
        }

        errors.push(error)
        overlapFoundInComponent = true
        break
      }
      if (overlapFoundInComponent) break
    }
  }

  return errors
}
