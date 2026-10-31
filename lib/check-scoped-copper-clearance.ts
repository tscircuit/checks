import { Relations } from "@flatten-js/core"
import { getPrimaryId } from "@tscircuit/circuit-json-util"
import {
  convertCircuitJsonToFlattenJs,
  type FlattenElement,
} from "@tscircuit/circuit-json-to-flattenjs"
import type {
  AnyCircuitElement,
  LayerRef,
  PcbClearanceError,
  PcbClearanceScope,
} from "circuit-json"
import {
  getFullConnectivityMapFromCircuitJson,
  type ConnectivityMap,
} from "circuit-json-to-connectivity-map"
import Flatbush from "flatbush"
import { getReadableNameForElementId } from "./util/get-readable-names"
import {
  resolveCopperClearance,
  UnverifiedClearanceRuleError,
  type ClearanceCopper,
} from "./scoped-clearance/resolve-copper-clearance"

/**
 * Measures finished copper edge-to-edge in board/world mm (+X right, +Y up).
 * Uses actual layer geometry and filled polygons, including pour holes.
 */
export function checkScopedCopperClearance(
  circuitJson: AnyCircuitElement[],
  {
    connMap = getFullConnectivityMapFromCircuitJson(circuitJson),
  }: { connMap?: ConnectivityMap } = {},
): PcbClearanceError[] {
  const boards = circuitJson.filter((element) => element.type === "pcb_board")
  const rules = boards
    .flatMap((board) => board.clearance_rules ?? [])
    .filter((rule) => rule.enabled)
  if (!rules.length) return []
  const unverified = (
    ruleName: string,
    ids: string[],
    message: string,
  ): PcbClearanceError => ({
    type: "pcb_clearance_error",
    error_type: "pcb_clearance_error",
    pcb_clearance_error_id: `unverified_clearance_${ids.join("_")}_${ruleName}`,
    rule_name: ruleName,
    pcb_element_ids: ids,
    is_fatal: true,
    message,
  })
  if (boards.length !== 1)
    return [
      unverified(
        "board scope",
        [],
        "Cannot verify scoped copper clearance across multiple boards",
      ),
    ]
  const idsByElement = new Map(
    circuitJson.map((element) => [getPrimaryId(element), element]),
  )
  const netIds = new Set(
    circuitJson.flatMap((element) =>
      element.type === "source_net" ? [element.source_net_id] : [],
    ),
  )
  const collectNets = (scope: PcbClearanceScope): void => {
    if (scope.type === "net") for (const id of scope.net_ids) netIds.add(id)
    if (scope.type === "and" || scope.type === "or")
      scope.scopes.forEach(collectNets)
    if (scope.type === "not") collectNets(scope.scope)
  }
  for (const rule of rules) {
    collectNets(rule.scope1)
    collectNets(rule.scope2)
  }
  for (const element of circuitJson)
    if (element.type === "source_trace") {
      for (const id of element.connected_source_net_ids ?? []) netIds.add(id)
    }
  const metadataById = new Map<string, Omit<ClearanceCopper, "layer">>()
  const metadata = (geometry: FlattenElement): ClearanceCopper => {
    let copper = metadataById.get(geometry.elementId)
    if (!copper) {
      const element = geometry.sourceElement
      const directNetId =
        "source_net_id" in element ? element.source_net_id : undefined
      const component =
        "pcb_component_id" in element
          ? idsByElement.get(element.pcb_component_id!)
          : undefined
      const sourceComponent =
        component?.type === "pcb_component"
          ? idsByElement.get(component.source_component_id)
          : undefined
      const componentName =
        sourceComponent && "name" in sourceComponent
          ? sourceComponent.name
          : undefined
      copper = {
        netIds: [...netIds].filter(
          (id) =>
            id === directNetId ||
            connMap.areIdsConnected(geometry.elementId, id),
        ),
        kind:
          element.type === "pcb_via"
            ? "via"
            : element.type === "pcb_trace"
              ? "trace"
              : element.type === "pcb_copper_pour"
                ? "copper_pour"
                : "pad",
        componentName,
        isKeepout: false,
        inPolygon: element.type === "pcb_copper_pour",
        isFree: !component,
      }
      metadataById.set(geometry.elementId, copper)
    }
    return { ...copper, layer: geometry.layer as LayerRef }
  }
  const { elements, warnings } = convertCircuitJsonToFlattenJs(circuitJson, {
    elementTypes: [
      "pcb_trace",
      "pcb_via",
      "pcb_smtpad",
      "pcb_plated_hole",
      "pcb_copper_pour",
    ],
    roles: ["copper"],
    includeDrillHoles: true,
  })
  const errors = new Map<string, PcbClearanceError>()
  for (const warning of warnings) {
    errors.set(
      warning.elementId,
      unverified(
        "copper geometry",
        [warning.elementId],
        `Cannot verify scoped clearance for ${getReadableNameForElementId(circuitJson, warning.elementId)} because its copper geometry is unsupported or invalid`,
      ),
    )
  }
  const maximumClearance = Math.max(...rules.map((rule) => rule.clearance))
  const layers = new Map<
    string,
    { element: FlattenElement; shape: FlattenElement["shapes"][number] }[]
  >()
  for (const element of elements) {
    if (element.role !== "copper" || element.layer === null) continue
    const entries = layers.get(element.layer) ?? []
    for (const shape of element.shapes) entries.push({ element, shape })
    layers.set(element.layer, entries)
  }
  for (const [layer, entries] of layers) {
    if (!entries.length) continue
    const index = new Flatbush(entries.length)
    for (const { shape } of entries) {
      const b = shape.box
      index.add(b.xmin, b.ymin, b.xmax, b.ymax)
    }
    index.finish()
    for (const [firstIndex, first] of entries.entries()) {
      const b = first.shape.box
      for (const secondIndex of index.search(
        b.xmin - maximumClearance,
        b.ymin - maximumClearance,
        b.xmax + maximumClearance,
        b.ymax + maximumClearance,
      )) {
        if (secondIndex <= firstIndex) continue
        const second = entries[secondIndex]!
        if (first.element.elementId === second.element.elementId) continue
        const firstCopper = metadata(first.element),
          secondCopper = metadata(second.element)
        if (
          connMap.areIdsConnected(
            first.element.elementId,
            second.element.elementId,
          ) ||
          firstCopper.netIds.some((id) => secondCopper.netIds.includes(id))
        )
          continue
        const ids = [first.element.elementId, second.element.elementId].sort()
        const key = `${layer}_${ids.join("_")}`
        let rule
        try {
          rule = resolveCopperClearance(rules, firstCopper, secondCopper)
        } catch (error) {
          if (!(error instanceof UnverifiedClearanceRuleError)) throw error
          errors.set(key, unverified(error.ruleName, ids, error.message))
          continue
        }
        if (!rule) continue
        const [distance, shortest] = first.shape.distanceTo(second.shape)
        const overlaps = Relations.intersect(first.shape, second.shape)
        const gap = overlaps ? 0 : distance
        if (!Number.isFinite(gap)) {
          errors.set(
            key,
            unverified(
              rule.name,
              ids,
              `Cannot measure copper gap for clearance rule ${rule.name}`,
            ),
          )
          continue
        }
        if (gap + 1e-9 >= rule.clearance) continue
        const previous = errors.get(key)
        if (previous && (previous.actual_clearance ?? -1) <= gap) continue
        const center = overlaps ? first.shape.box.center : shortest.middle()
        errors.set(key, {
          type: "pcb_clearance_error",
          error_type: "pcb_clearance_error",
          pcb_clearance_error_id: `scoped_clearance_${key}`,
          rule_name: rule.name,
          pcb_element_ids: ids,
          layer: layer as LayerRef,
          minimum_clearance: rule.clearance,
          actual_clearance: gap,
          center: { x: center.x, y: center.y },
          message: `Clearance rule ${rule.name}: ${getReadableNameForElementId(circuitJson, ids[0]!)} and ${getReadableNameForElementId(circuitJson, ids[1]!)} have ${gap.toFixed(3)}mm copper gap on ${layer}; ${rule.clearance.toFixed(3)}mm is required`,
        })
      }
    }
  }
  return [...errors.values()]
}
