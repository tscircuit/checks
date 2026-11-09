import { BooleanOperations, Point, Segment, Vector } from "@flatten-js/core"
import { convertCircuitJsonToFlattenJs } from "@tscircuit/circuit-json-to-flattenjs"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbPlacementError,
  PcbPanel,
} from "circuit-json"
import { findMouseBiteRows } from "./util/find-mouse-bite-rows"
import { getReadableNameForElementId } from "./util/get-readable-names"

export interface PcbBoardSupportError extends PcbPlacementError {
  pcb_board_id?: PcbBoard["pcb_board_id"]
  pcb_panel_id?: PcbPanel["pcb_panel_id"]
  support_count: number
  center: { x: number; y: number }
  /** Affected region bounds, in circuit-world millimeters. */
  width?: number
  height?: number
}

/** Detect severely unsupported mouse-bite regions from emitted manufacturing
 * geometry, including manually panelized files containing only one pcb_board.
 * All polygons/positions are circuit-world mm, +X right/+Y up; normals are
 * directions. This is a geometric DRC, not a mechanical load/deflection model.
 * Regions below 25 mm² are excluded as possible tab remnants. Unperforated
 * tabs, V-scores and curved perforation rows are not inferred.
 */
export function checkPcbBoardSupport(
  circuitJson: AnyCircuitElement[],
): PcbBoardSupportError[] {
  if (!circuitJson.some((e) => e.type === "pcb_cutout")) return []
  const holes = circuitJson.filter((e) => e.type === "pcb_hole")
  if (holes.length < 2) return []
  // A native panel's outer laminate is its panel rectangle. Child board
  // envelopes must not be mistaken for separate manufacturing panels.
  const panels = circuitJson.filter((e) => e.type === "pcb_panel")
  const boards = panels.length
    ? panels.map(
        (panel): PcbBoard => ({
          type: "pcb_board",
          pcb_board_id: panel.pcb_panel_id,
          center: panel.center,
          width: panel.width,
          height: panel.height,
          thickness: panel.thickness,
          num_layers: 2,
          material: "fr4",
        }),
      )
    : circuitJson.filter((e) => e.type === "pcb_board")
  const { elements, warnings } = convertCircuitJsonToFlattenJs(
    [
      ...circuitJson.filter(
        (e) => e.type === "pcb_cutout" || e.type === "pcb_hole",
      ),
      ...boards,
    ],
    { elementTypes: ["pcb_board", "pcb_cutout", "pcb_hole"] },
  )
  const slots = elements
    .filter((e) => e.role === "cutout")
    .flatMap((e) => e.shapes)
  const rows = findMouseBiteRows(holes, slots)
  if (!rows.length) return []
  if (warnings.length)
    return warnings.map((warning) => ({
      type: "pcb_placement_error",
      error_type: "pcb_placement_error",
      pcb_placement_error_id: `unverified_board_support_${warning.elementId}`,
      support_count: 0,
      center: { x: 0, y: 0 },
      message: `Cannot verify panel support because the geometry of ${getReadableNameForElementId(circuitJson, warning.elementId)} is unsupported or invalid.`,
    }))
  const drills = elements
    .filter((e) => e.role === "drill")
    .flatMap((e) => e.shapes)
  const errors: PcbBoardSupportError[] = []
  for (const board of boards) {
    const envelope = elements.find(
      (e) => e.role === "board" && e.elementId === board.pcb_board_id,
    )?.shapes[0]
    if (!envelope) continue
    const localRows = rows.filter((row) =>
      row.probes.some(([a, b]) => envelope.contains(a) || envelope.contains(b)),
    )
    if (!localRows.length) continue
    let material = envelope.clone()
    for (const slot of slots)
      material = BooleanOperations.subtract(material, slot)
    // Closing perforation rows virtually depanelizes the laminate. This lets
    // us recover board regions without relying on TSX provenance or IDs.
    let separated = material.clone()
    for (const row of localRows)
      separated = BooleanOperations.subtract(separated, row.band)
    const regions = separated.splitToIslands()
    const supports = regions.map(() => [] as Vector[])
    for (const row of localRows) {
      const attached = new Set<number>()
      for (const [a, b] of row.probes) {
        const web = new Segment(a, b)
        if (!material.contains(web)) continue // tab was routed away
        if (
          drills.some(
            (drill) =>
              drill.box.intersect(web.box) &&
              (drill.contains(a) ||
                drill.contains(b) ||
                drill.intersect(web).length > 0),
          )
        )
          continue
        const first = regions.findIndex((region) => region.contains(a))
        const second = regions.findIndex((region) => region.contains(b))
        if (first < 0 || second < 0 || first === second) continue
        if (!attached.has(first)) supports[first]!.push(row.normal.multiply(-1))
        if (!attached.has(second)) supports[second]!.push(row.normal)
        attached.add(first)
        attached.add(second)
      }
    }
    for (const [regionIndex, region] of regions.entries()) {
      // Ignore small remnants between two perforation rows, and the outer
      // carrier, which reaches the original manufacturing outline.
      if (
        region.area() < 25 ||
        region.vertices.some((p) => envelope.findEdgeByPoint(p) !== undefined)
      )
        continue
      const directions = supports[regionIndex]!
      const oneSide =
        directions.length > 0 &&
        directions.every((normal) => normal.dot(directions[0]!) > 0.98)
      if (directions.length >= 2 && !oneSide) continue
      const center = region.box.center
      const component = circuitJson.find(
        (e) =>
          e.type === "pcb_component" &&
          region.contains(new Point(e.center.x, e.center.y)),
      )
      const label =
        component?.type === "pcb_component"
          ? `PCB region containing ${getReadableNameForElementId(circuitJson, component.pcb_component_id)}`
          : "Unnamed PCB region"
      errors.push({
        type: "pcb_placement_error",
        error_type: "pcb_placement_error",
        pcb_placement_error_id: `poor_board_support_${board.pcb_board_id}_${regionIndex}`,
        ...(panels.length
          ? { pcb_panel_id: board.pcb_board_id }
          : { pcb_board_id: board.pcb_board_id }),
        support_count: directions.length,
        center: { x: center.x, y: center.y },
        width: region.box.xmax - region.box.xmin,
        height: region.box.ymax - region.box.ymin,
        message: `${label} is poorly supported: ${directions.length < 2 ? `only ${directions.length} surviving mouse-bite tab(s)` : "all surviving mouse-bite tabs attach along one side"}. Add support on another side or a solid carrier rail; neighboring routing slots may have removed intended tabs.`,
      })
    }
  }
  return errors
}
