import type {
  AnyCircuitElement,
  PcbBoard,
  PcbComponent,
  AnySourceComponent,
} from "circuit-json"
import { getReadableNameForElement } from "@tscircuit/circuit-json-util"
import * as Flatten from "@flatten-js/core"

export interface PcbComponentOutsideBoardErrorData {
  type: "pcb_component_outside_board_error"
  error_type: "pcb_component_outside_board_error"
  pcb_component_outside_board_error_id: string
  message: string
  pcb_component_id: string
  pcb_board_id: string
  component_center: { x: number; y: number }
  component_bounds: {
    min_x: number
    max_x: number
    min_y: number
    max_y: number
  }
  subcircuit_id?: string
  source_component_id?: string
}

interface Point {
  x: number
  y: number
}

interface Bounds {
  min_x: number
  max_x: number
  min_y: number
  max_y: number
}

/**
 * Transform a point using a 2D transformation matrix for rotation
 */
function transformPoint(
  point: Point,
  centerX: number,
  centerY: number,
  rotationRadians: number,
): Point {
  // Translate point to origin (relative to center)
  const relativeX = point.x - centerX
  const relativeY = point.y - centerY

  // Apply rotation matrix
  const cos = Math.cos(rotationRadians)
  const sin = Math.sin(rotationRadians)

  const rotatedX = relativeX * cos - relativeY * sin
  const rotatedY = relativeX * sin + relativeY * cos

  // Translate back to original position
  return {
    x: rotatedX + centerX,
    y: rotatedY + centerY,
  }
}

/**
 * Calculate the rotated bounding box for a component
 */
function calculateRotatedComponentBounds(
  component: PcbComponent,
): Bounds | null {
  if (
    !component.center ||
    typeof component.width !== "number" ||
    typeof component.height !== "number"
  ) {
    return null
  }

  const { x: centerX, y: centerY } = component.center
  const halfWidth = component.width / 2
  const halfHeight = component.height / 2
  const rotationRadians = ((component.rotation || 0) * Math.PI) / 180

  // Define the four corners of the component rectangle
  const corners: Point[] = [
    { x: centerX - halfWidth, y: centerY - halfHeight }, // bottom-left
    { x: centerX + halfWidth, y: centerY - halfHeight }, // bottom-right
    { x: centerX + halfWidth, y: centerY + halfHeight }, // top-right
    { x: centerX - halfWidth, y: centerY + halfHeight }, // top-left
  ]

  // Transform all corners with the rotation
  const transformedCorners = corners.map((corner) =>
    transformPoint(corner, centerX, centerY, rotationRadians),
  )

  // Find the bounding box of the transformed corners
  const xs = transformedCorners.map((p) => p.x)
  const ys = transformedCorners.map((p) => p.y)

  return {
    min_x: Math.min(...xs),
    max_x: Math.max(...xs),
    min_y: Math.min(...ys),
    max_y: Math.max(...ys),
  }
}

/**
 * Calculate board bounds for rectangular boards
 */
function calculateRectangularBoardBounds(board: PcbBoard): Bounds | null {
  if (
    !board.center ||
    typeof board.width !== "number" ||
    typeof board.height !== "number"
  ) {
    return null
  }

  const { x: centerX, y: centerY } = board.center
  const halfWidth = board.width / 2
  const halfHeight = board.height / 2

  return {
    min_x: centerX - halfWidth,
    max_x: centerX + halfWidth,
    min_y: centerY - halfHeight,
    max_y: centerY + halfHeight,
  }
}

/**
 * Calculate board bounds for custom board outlines
 */
function calculateCustomBoardBounds(board: PcbBoard): Bounds | null {
  if (
    !board.outline ||
    !Array.isArray(board.outline) ||
    board.outline.length === 0
  ) {
    return null
  }

  const xs = board.outline.map((point) => point.x)
  const ys = board.outline.map((point) => point.y)

  return {
    min_x: Math.min(...xs),
    max_x: Math.max(...xs),
    min_y: Math.min(...ys),
    max_y: Math.max(...ys),
  }
}

/**
 * Check collision between component bounds and board bounds using proper polygon intersection
 */
function checkBoundsCollision(
  componentBounds: Bounds,
  boardBounds: Bounds,
  board: PcbBoard,
): { isOutside: boolean; overlapDistance: number } {
  // For rectangular boards, simple bounds check
  if (!board.outline) {
    const isOutside =
      componentBounds.min_x < boardBounds.min_x ||
      componentBounds.max_x > boardBounds.max_x ||
      componentBounds.min_y < boardBounds.min_y ||
      componentBounds.max_y > boardBounds.max_y

    let overlapDistance = 0
    if (isOutside) {
      const overlapLeft = Math.max(0, boardBounds.min_x - componentBounds.min_x)
      const overlapRight = Math.max(
        0,
        componentBounds.max_x - boardBounds.max_x,
      )
      const overlapBottom = Math.max(
        0,
        boardBounds.min_y - componentBounds.min_y,
      )
      const overlapTop = Math.max(0, componentBounds.max_y - boardBounds.max_y)

      overlapDistance = Math.max(
        overlapLeft,
        overlapRight,
        overlapBottom,
        overlapTop,
      )
    }

    return { isOutside, overlapDistance }
  }

  // For custom board outlines, use flattenjs for proper polygon intersection
  try {
    // Create component rectangle polygon
    const componentPolygon = new Flatten.Polygon([
      new Flatten.Point(componentBounds.min_x, componentBounds.min_y),
      new Flatten.Point(componentBounds.max_x, componentBounds.min_y),
      new Flatten.Point(componentBounds.max_x, componentBounds.max_y),
      new Flatten.Point(componentBounds.min_x, componentBounds.max_y),
    ])

    // Create board outline polygon
    const boardOutlinePoints = board.outline!.map(
      (p) => new Flatten.Point(p.x, p.y),
    )
    const boardPolygon = new Flatten.Polygon(boardOutlinePoints)

    // Check if component is completely contained within board
    const isComponentInsideBoard = boardPolygon.contains(componentPolygon)
    const isOutside = !isComponentInsideBoard

    let overlapDistance = 0
    if (isOutside) {
      // Calculate the intersection area to determine overlap
      const intersection = Flatten.BooleanOperations.intersect(
        componentPolygon,
        boardPolygon,
      )
      const componentArea = componentPolygon.area()
      const intersectionArea = intersection.area()

      // If there's partial intersection, calculate approximate overlap distance
      if (intersectionArea > 0 && intersectionArea < componentArea) {
        const overlapRatio = 1 - intersectionArea / componentArea
        const componentWidth = componentBounds.max_x - componentBounds.min_x
        const componentHeight = componentBounds.max_y - componentBounds.min_y
        overlapDistance =
          Math.min(componentWidth, componentHeight) * overlapRatio
      } else if (intersectionArea === 0) {
        // Component is completely outside - calculate distance to nearest board edge
        const componentCenter = new Flatten.Point(
          (componentBounds.min_x + componentBounds.max_x) / 2,
          (componentBounds.min_y + componentBounds.max_y) / 2,
        )
        overlapDistance = boardPolygon.distanceTo(componentCenter)[0]
      } else {
        // Small overlap case
        overlapDistance = 0.1
      }
    }

    return { isOutside, overlapDistance }
  } catch (error) {
    // Fallback to simple bounds check if flattenjs fails
    console.warn(
      "Flattenjs polygon collision detection failed, falling back to bounds check:",
      error,
    )

    const centerX = (componentBounds.min_x + componentBounds.max_x) / 2
    const centerY = (componentBounds.min_y + componentBounds.max_y) / 2

    // Simple point-in-polygon check for center point as fallback
    let inside = false
    const outline = board.outline!
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      if (
        outline[i].y > centerY !== outline[j].y > centerY &&
        centerX <
          ((outline[j].x - outline[i].x) * (centerY - outline[i].y)) /
            (outline[j].y - outline[i].y) +
            outline[i].x
      ) {
        inside = !inside
      }
    }

    const isOutside = !inside
    let overlapDistance = 0
    if (isOutside) {
      const distancesToBoardBounds = [
        Math.abs(centerX - boardBounds.min_x),
        Math.abs(centerX - boardBounds.max_x),
        Math.abs(centerY - boardBounds.min_y),
        Math.abs(centerY - boardBounds.max_y),
      ]
      overlapDistance = Math.min(...distancesToBoardBounds)
    }

    return { isOutside, overlapDistance }
  }
}

/**
 * Get component name from circuit JSON
 */
function getComponentName(
  circuitJson: AnyCircuitElement[],
  component: PcbComponent,
): string {
  if (component.source_component_id) {
    const sourceComponent = circuitJson.find(
      (el): el is AnySourceComponent =>
        el.type === "source_component" &&
        el.source_component_id === component.source_component_id,
    )
    if (sourceComponent && "name" in sourceComponent && sourceComponent.name) {
      return sourceComponent.name
    }
  }

  return (
    getReadableNameForElement(circuitJson, component.pcb_component_id) ||
    "Unknown"
  )
}

export function checkPcbComponentsOutOfBoard(
  circuitJson: AnyCircuitElement[],
): PcbComponentOutsideBoardErrorData[] {
  const board = circuitJson.find(
    (el): el is PcbBoard => el.type === "pcb_board",
  )
  if (!board) {
    return []
  }

  const components = circuitJson.filter(
    (el): el is PcbComponent => el.type === "pcb_component",
  )
  if (components.length === 0) {
    return []
  }

  // Calculate board bounds
  const boardBounds = board.outline
    ? calculateCustomBoardBounds(board)
    : calculateRectangularBoardBounds(board)

  if (!boardBounds) {
    return [] // Skip if board bounds cannot be calculated
  }

  const errors: PcbComponentOutsideBoardErrorData[] = []

  for (const component of components) {
    // Skip components without required properties
    const componentBounds = calculateRotatedComponentBounds(component)
    if (!componentBounds) {
      continue
    }

    // Check collision
    const { isOutside, overlapDistance } = checkBoundsCollision(
      componentBounds,
      boardBounds,
      board,
    )

    if (isOutside) {
      const componentName = getComponentName(circuitJson, component)
      const overlapDistanceMm = Math.round(overlapDistance * 100) / 100 // Round to 2 decimal places

      errors.push({
        type: "pcb_component_outside_board_error",
        error_type: "pcb_component_outside_board_error",
        pcb_component_outside_board_error_id: `pcb_component_outside_board_${component.pcb_component_id}`,
        message: `Component ${componentName} (${component.pcb_component_id}) extends outside board boundaries by ${overlapDistanceMm}mm`,
        pcb_component_id: component.pcb_component_id,
        pcb_board_id: board.pcb_board_id,
        component_center: component.center,
        component_bounds: componentBounds,
        subcircuit_id: component.subcircuit_id,
        source_component_id: component.source_component_id,
      })
    }
  }

  return errors
}
