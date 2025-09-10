import { test, expect } from "bun:test"
import { checkPcbComponentsOutOfBoard } from "../../lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import type {
  AnyCircuitElement,
  PcbBoard,
  PcbComponent,
  AnySourceComponent,
} from "circuit-json"

// Helper function to create a basic rectangular board
function createRectangularBoard(
  id: string = "board1",
  center: { x: number; y: number } = { x: 0, y: 0 },
  width: number = 10,
  height: number = 8,
): PcbBoard {
  return {
    type: "pcb_board",
    pcb_board_id: id,
    center,
    width,
    height,
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
  }
}

// Helper function to create a custom board outline
function createCustomBoardOutline(
  id: string = "board1",
  outline: Array<{ x: number; y: number }> = [
    { x: -5, y: -4 },
    { x: 5, y: -4 },
    { x: 5, y: 4 },
    { x: -5, y: 4 },
  ],
): PcbBoard {
  return {
    type: "pcb_board",
    pcb_board_id: id,
    outline,
    width: 10,
    height: 8,
    center: { x: 0, y: 0 },
    thickness: 1.6,
    num_layers: 2,
    material: "fr4",
  }
}

// Helper function to create a PCB component
function createPcbComponent(
  id: string = "comp1",
  center: { x: number; y: number } = { x: 0, y: 0 },
  width: number = 2,
  height: number = 1,
  rotation: number = 0,
  sourceComponentId?: string,
): PcbComponent {
  const component: PcbComponent = {
    type: "pcb_component",
    pcb_component_id: id,
    source_component_id: sourceComponentId || "",
    center,
    width,
    height,
    rotation,
    layer: "top",
  }

  return component
}

// Helper function to create a source component
function createSourceComponent(
  id: string = "source1",
  name: string = "R1",
): AnySourceComponent {
  return {
    type: "source_component",
    source_component_id: id,
    name,
    ftype: "simple_resistor",
    resistance: 1000,
  } as AnySourceComponent
}

test("checkPcbComponentsOutOfBoard - component within rectangular board boundaries (no error)", () => {
  const board = createRectangularBoard("board1", { x: 0, y: 0 }, 10, 8)
  const component = createPcbComponent("comp1", { x: 0, y: 0 }, 2, 1)

  const circuitJson: AnyCircuitElement[] = [board, component]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(errors).toHaveLength(0)
})

test("checkPcbComponentsOutOfBoard - component outside rectangular board boundaries", () => {
  const board = createRectangularBoard("board1", { x: 0, y: 0 }, 10, 8)
  const component = createPcbComponent("comp1", { x: 6, y: 0 }, 2, 1) // extends beyond board width
  const sourceComponent = createSourceComponent("source1", "R1")

  const circuitJson: AnyCircuitElement[] = [board, component, sourceComponent]
  component.source_component_id = "source1"

  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_component_outside_board_error",
    error_type: "pcb_component_outside_board_error",
    pcb_component_id: "comp1",
    pcb_board_id: "board1",
    component_center: { x: 6, y: 0 },
    source_component_id: "source1",
  })
  expect(errors[0].message).toContain("R1")
  expect(errors[0].message).toContain("extends outside board boundaries")
})

test("checkPcbComponentsOutOfBoard - rotated component extending outside board", () => {
  const board = createRectangularBoard("board1", { x: 0, y: 0 }, 6, 6)
  // A 4x1 component rotated 45 degrees at the edge should extend outside
  const component = createPcbComponent("comp1", { x: 3, y: 3 }, 4, 1, 45)

  const circuitJson: AnyCircuitElement[] = [board, component]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_component_id).toBe("comp1")
})

test("checkPcbComponentsOutOfBoard - component outside custom board outline", () => {
  // Create a diamond-shaped board
  const board = createCustomBoardOutline("board1", [
    { x: 0, y: -5 },
    { x: 5, y: 0 },
    { x: 0, y: 5 },
    { x: -5, y: 0 },
  ])

  // Place component at corner where it would be outside the diamond
  const component = createPcbComponent("comp1", { x: 4, y: 4 }, 2, 2)

  const circuitJson: AnyCircuitElement[] = [board, component]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_component_id).toBe("comp1")
})

test("checkPcbComponentsOutOfBoard - component partially intersecting custom board outline", () => {
  // Create a L-shaped board
  const board = createCustomBoardOutline("board1", [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 3 },
    { x: 3, y: 3 },
    { x: 3, y: 6 },
    { x: 0, y: 6 },
  ])

  // Place component that partially intersects with the L-shape (crosses the inner corner)
  const component = createPcbComponent("comp1", { x: 4.5, y: 4.5 }, 3, 3)

  const circuitJson: AnyCircuitElement[] = [board, component]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_component_id).toBe("comp1")
  expect(errors[0].message).toContain("extends outside board boundaries")
})

test("checkPcbComponentsOutOfBoard - component completely within custom board outline", () => {
  // Create a hexagonal board
  const board = createCustomBoardOutline("board1", [
    { x: 2, y: 0 },
    { x: 4, y: 1 },
    { x: 4, y: 3 },
    { x: 2, y: 4 },
    { x: 0, y: 3 },
    { x: 0, y: 1 },
  ])

  // Place small component completely inside
  const component = createPcbComponent("comp1", { x: 2, y: 2 }, 1, 1)

  const circuitJson: AnyCircuitElement[] = [board, component]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(errors).toHaveLength(0) // Should be no errors
})

test("checkPcbComponentsOutOfBoard - rotated component vs complex polygon", () => {
  // Create a star-like board shape
  const board = createCustomBoardOutline("board1", [
    { x: 0, y: -4 },
    { x: 1, y: -1 },
    { x: 4, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 4 },
    { x: -1, y: 1 },
    { x: -4, y: 0 },
    { x: -1, y: -1 },
  ])

  // Place rotated component that should intersect with one of the "arms"
  const component = createPcbComponent("comp1", { x: 3, y: 2 }, 2, 1, 45)

  const circuitJson: AnyCircuitElement[] = [board, component]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_component_id).toBe("comp1")
})

test("checkPcbComponentsOutOfBoard - multiple components with mixed placement", () => {
  const board = createRectangularBoard("board1", { x: 0, y: 0 }, 10, 8)
  const componentInside = createPcbComponent("comp1", { x: 0, y: 0 }, 2, 1)
  const componentOutside1 = createPcbComponent("comp2", { x: 6, y: 0 }, 2, 1) // extends right
  const componentOutside2 = createPcbComponent("comp3", { x: 0, y: 5 }, 2, 1) // extends top

  const circuitJson: AnyCircuitElement[] = [
    board,
    componentInside,
    componentOutside1,
    componentOutside2,
  ]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(errors).toHaveLength(2)
  expect(errors.map((e) => e.pcb_component_id)).toContain("comp2")
  expect(errors.map((e) => e.pcb_component_id)).toContain("comp3")
  expect(errors.map((e) => e.pcb_component_id)).not.toContain("comp1")
})

test("checkPcbComponentsOutOfBoard - components without required properties (skip gracefully)", () => {
  const board = createRectangularBoard("board1", { x: 0, y: 0 }, 10, 8)
  const incompleteComponent1: Partial<PcbComponent> = {
    type: "pcb_component",
    pcb_component_id: "comp1",
    // Missing center, width, height
  }
  const incompleteComponent2: Partial<PcbComponent> = {
    type: "pcb_component",
    pcb_component_id: "comp2",
    center: { x: 0, y: 0 },
    // Missing width, height
  }

  const circuitJson: AnyCircuitElement[] = [
    board,
    incompleteComponent1 as PcbComponent,
    incompleteComponent2 as PcbComponent,
  ]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(errors).toHaveLength(0) // Should skip invalid components
})

test("checkPcbComponentsOutOfBoard - boards without boundary definitions (skip validation)", () => {
  const incompleteBoard: Partial<PcbBoard> = {
    type: "pcb_board",
    pcb_board_id: "board1",
    // Missing center, width, height, and outline
  }
  const component = createPcbComponent("comp1", { x: 0, y: 0 }, 2, 1)

  const circuitJson: AnyCircuitElement[] = [
    incompleteBoard as PcbBoard,
    component,
  ]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(errors).toHaveLength(0) // Should skip if board bounds cannot be calculated
})

test("checkPcbComponentsOutOfBoard - zero-size components (skip validation)", () => {
  const board = createRectangularBoard("board1", { x: 0, y: 0 }, 10, 8)
  const zeroWidthComponent = createPcbComponent("comp1", { x: 0, y: 0 }, 0, 1)
  const zeroHeightComponent = createPcbComponent("comp2", { x: 0, y: 0 }, 2, 0)

  const circuitJson: AnyCircuitElement[] = [
    board,
    zeroWidthComponent,
    zeroHeightComponent,
  ]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(errors).toHaveLength(0) // Should skip zero-size components gracefully
})

test("checkPcbComponentsOutOfBoard - no board in circuit (return empty)", () => {
  const component = createPcbComponent("comp1", { x: 0, y: 0 }, 2, 1)

  const circuitJson: AnyCircuitElement[] = [component]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(errors).toHaveLength(0)
})

test("checkPcbComponentsOutOfBoard - no components in circuit (return empty)", () => {
  const board = createRectangularBoard("board1", { x: 0, y: 0 }, 10, 8)

  const circuitJson: AnyCircuitElement[] = [board]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(errors).toHaveLength(0)
})

test("checkPcbComponentsOutOfBoard - component extends multiple directions", () => {
  const board = createRectangularBoard("board1", { x: 0, y: 0 }, 4, 4)
  // Large component that extends in all directions
  const component = createPcbComponent("comp1", { x: 0, y: 0 }, 6, 6)

  const circuitJson: AnyCircuitElement[] = [board, component]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0].component_bounds.min_x).toBeLessThan(-2) // Extends left beyond board
  expect(errors[0].component_bounds.max_x).toBeGreaterThan(2) // Extends right beyond board
  expect(errors[0].component_bounds.min_y).toBeLessThan(-2) // Extends bottom beyond board
  expect(errors[0].component_bounds.max_y).toBeGreaterThan(2) // Extends top beyond board
})

test("checkPcbComponentsOutOfBoard - component with invalid rotation (handle gracefully)", () => {
  const board = createRectangularBoard("board1", { x: 0, y: 0 }, 10, 8)
  const component = createPcbComponent("comp1", { x: 0, y: 0 }, 2, 1, NaN) // Invalid rotation

  const circuitJson: AnyCircuitElement[] = [board, component]

  // Should not throw error and treat as no rotation
  expect(() => checkPcbComponentsOutOfBoard(circuitJson)).not.toThrow()
  const errors = checkPcbComponentsOutOfBoard(circuitJson)
  expect(errors).toHaveLength(0) // Component should be within bounds without rotation
})

test("checkPcbComponentsOutOfBoard - error message format and precision", () => {
  const board = createRectangularBoard("board1", { x: 0, y: 0 }, 10, 8)
  const component = createPcbComponent("comp1", { x: 6, y: 0 }, 2, 1) // extends 2mm beyond board
  const sourceComponent = createSourceComponent("source1", "R1")
  component.source_component_id = "source1"

  const circuitJson: AnyCircuitElement[] = [board, component, sourceComponent]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(errors).toHaveLength(1)
  expect(errors[0].message).toMatch(
    /Component R1 \(comp1\) extends outside board boundaries by \d+(\.\d+)?mm/,
  )

  // Check that the overlap distance is reasonable (should be 2mm in this case)
  const overlapMatch = errors[0].message.match(/by (\d+(?:\.\d+)?)mm/)
  expect(overlapMatch).toBeTruthy()
  if (overlapMatch) {
    const overlapDistance = parseFloat(overlapMatch[1])
    expect(overlapDistance).toBeGreaterThan(0)
    expect(overlapDistance).toBeLessThanOrEqual(2)
  }
})

test("checkPcbComponentsOutOfBoard - component bounds calculation accuracy", () => {
  const board = createRectangularBoard("board1", { x: 0, y: 0 }, 10, 8)
  // Component extending outside board: center at (4, 0) with size 4x2
  // This will have bounds [2, 6] in X, which extends beyond board bound of 5
  const component = createPcbComponent("comp1", { x: 4, y: 0 }, 4, 2, 0)

  const circuitJson: AnyCircuitElement[] = [board, component]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(errors).toHaveLength(1)

  // Component centered at (4,0) with size 4x2 should have bounds:
  // min_x: 2, max_x: 6, min_y: -1, max_y: 1
  expect(errors[0].component_bounds.min_x).toBe(2)
  expect(errors[0].component_bounds.max_x).toBe(6)
  expect(errors[0].component_bounds.min_y).toBe(-1)
  expect(errors[0].component_bounds.max_y).toBe(1)
  expect(errors[0].component_center.x).toBe(4)
  expect(errors[0].component_center.y).toBe(0)
})
