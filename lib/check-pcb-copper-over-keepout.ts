import { cju, getPrimaryId } from "@tscircuit/circuit-json-util"
import type {
  AnyCircuitElement,
  PCBKeepout,
  PcbPlacementError,
  PcbVia,
} from "circuit-json"
import {
  type PadClearanceElement,
  getPadToPadGap,
  getPads,
} from "./check-pad-clearance/common"
import { EPSILON } from "./drc-defaults"
import { getReadableNameForComponent } from "./util/get-readable-names"
import { getLayersOfPcbElement } from "./util/getLayersOfPcbElement"

const getErrorOwnerId = (copper: PadClearanceElement) =>
  "pcb_component_id" in copper && copper.pcb_component_id
    ? copper.pcb_component_id
    : getPrimaryId(copper)

const getReadableCopperName = (
  circuitJson: AnyCircuitElement[],
  copper: PadClearanceElement,
) => {
  if ("pcb_component_id" in copper && copper.pcb_component_id) {
    const pcbComponent = circuitJson.find(
      (element) =>
        element.type === "pcb_component" &&
        element.pcb_component_id === copper.pcb_component_id,
    )
    const sourceComponent =
      pcbComponent?.type === "pcb_component"
        ? circuitJson.find(
            (element) =>
              element.type === "source_component" &&
              element.source_component_id === pcbComponent.source_component_id,
          )
        : undefined
    const componentName =
      sourceComponent?.type === "source_component" && sourceComponent.name
        ? sourceComponent.name
        : getReadableNameForComponent(circuitJson, copper.pcb_component_id)

    return `component ${componentName}`
  }

  return copper.type === "pcb_via"
    ? `via ${copper.pcb_via_id}`
    : `${copper.type} ${getPrimaryId(copper)}`
}

export function checkPcbCopperOverKeepout(
  circuitJson: AnyCircuitElement[],
): PcbPlacementError[] {
  const keepouts = cju(circuitJson).pcb_keepout.list() as PCBKeepout[]
  if (keepouts.length === 0) return []

  const copper: PadClearanceElement[] = [
    ...getPads(circuitJson),
    ...(cju(circuitJson).pcb_via.list() as PcbVia[]),
  ]
  const errors = new Map<string, PcbPlacementError>()

  for (const keepout of keepouts) {
    const excludedComponentIds = new Set(
      keepout.excluded_pcb_component_ids ?? [],
    )

    for (const copperElement of copper) {
      const copperComponentId =
        "pcb_component_id" in copperElement
          ? copperElement.pcb_component_id
          : undefined
      if (copperComponentId && excludedComponentIds.has(copperComponentId)) {
        continue
      }

      const copperLayers = getLayersOfPcbElement(copperElement)
      if (!copperLayers.some((layer) => keepout.layers.includes(layer))) {
        continue
      }

      if (getPadToPadGap(copperElement, keepout) > EPSILON) continue

      const ownerId = getErrorOwnerId(copperElement)
      const errorId = `copper_over_keepout_${ownerId}_${keepout.pcb_keepout_id}`
      if (errors.has(errorId)) continue

      errors.set(errorId, {
        type: "pcb_placement_error",
        pcb_placement_error_id: errorId,
        error_type: "pcb_placement_error",
        message: `Copper for ${getReadableCopperName(
          circuitJson,
          copperElement,
        )} overlaps ${
          keepout.description
            ? `PCB keepout "${keepout.description}"`
            : "a PCB keepout"
        }`,
        subcircuit_id: copperElement.subcircuit_id ?? keepout.subcircuit_id,
      })
    }
  }

  return [...errors.values()]
}
