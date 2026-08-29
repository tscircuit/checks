import type { AnyCircuitElement, SchematicText } from "circuit-json"

const POSITION_TOLERANCE = 1e-6
const ROTATION_TOLERANCE = 1e-6

/**
 * This mirrors the Circuit JSON warning added in
 * https://github.com/tscircuit/circuit-json/pull/740.
 */
export interface SchematicTextOverlapWarning {
  type: "schematic_text_overlap_warning"
  schematic_text_overlap_warning_id: string
  warning_type: "schematic_text_overlap_warning"
  message: string
  schematic_text_ids: [string, string]
  schematic_sheet_id?: string
  subcircuit_id?: string
}

const normalizeRotation = (rotation: number) => ((rotation % 360) + 360) % 360

const rotationsMatch = (rotationA: number, rotationB: number) => {
  const difference = Math.abs(
    normalizeRotation(rotationA) - normalizeRotation(rotationB),
  )
  return Math.min(difference, 360 - difference) <= ROTATION_TOLERANCE
}

const isStandaloneText = (text: SchematicText) =>
  text.text.trim().length > 0 &&
  !text.schematic_component_id &&
  !text.schematic_symbol_id &&
  !text.source_trace_id

const haveSamePlacement = (textA: SchematicText, textB: SchematicText) =>
  textA.schematic_sheet_id === textB.schematic_sheet_id &&
  textA.subcircuit_id === textB.subcircuit_id &&
  textA.anchor === textB.anchor &&
  rotationsMatch(textA.rotation, textB.rotation) &&
  Math.abs(textA.position.x - textB.position.x) <= POSITION_TOLERANCE &&
  Math.abs(textA.position.y - textB.position.y) <= POSITION_TOLERANCE

/**
 * Detects standalone schematic text elements rendered at the same origin.
 *
 * Requiring the same sheet, subcircuit, anchor, and rotation keeps this check
 * focused on accidentally stacked headings instead of component-owned labels.
 */
export function checkSchematicTextOverlap(
  circuitJson: AnyCircuitElement[],
): SchematicTextOverlapWarning[] {
  const texts = circuitJson.filter(
    (element): element is SchematicText =>
      element.type === "schematic_text" && isStandaloneText(element),
  )
  const warnings: SchematicTextOverlapWarning[] = []

  for (let indexA = 0; indexA < texts.length; indexA++) {
    for (let indexB = indexA + 1; indexB < texts.length; indexB++) {
      const textA = texts[indexA]!
      const textB = texts[indexB]!
      if (!haveSamePlacement(textA, textB)) continue

      const [firstText, secondText] = [textA, textB].sort((a, b) =>
        a.schematic_text_id.localeCompare(b.schematic_text_id),
      ) as [SchematicText, SchematicText]

      warnings.push({
        type: "schematic_text_overlap_warning",
        schematic_text_overlap_warning_id: `schematic_text_overlap_warning_${firstText.schematic_text_id}_${secondText.schematic_text_id}`,
        warning_type: "schematic_text_overlap_warning",
        message: `Schematic text "${firstText.text}" and "${secondText.text}" are stacked at the same position`,
        schematic_text_ids: [
          firstText.schematic_text_id,
          secondText.schematic_text_id,
        ],
        schematic_sheet_id: firstText.schematic_sheet_id,
        subcircuit_id: firstText.subcircuit_id,
      })
    }
  }

  return warnings
}
