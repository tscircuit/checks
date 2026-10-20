import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkCopperToBoardEdgeClearance } from "lib/check-copper-to-board-edge-clearance"
import { checkViasOffBoard } from "lib/check-pcb-components-out-of-board/checkViasOffBoard"
import { checkPcbTracesOutOfBoard } from "lib/check-trace-out-of-board/checkTraceOutOfBoard"
import {
  firstBoard,
  secondBoard,
} from "../fixtures/multi-board-component-containment"

test("copper-to-board-edge clearance and via-off-board checks evaluate each element against its owning board", () => {
  const validViaOnSecondBoard: AnyCircuitElement = {
    type: "pcb_via",
    pcb_via_id: "via_b_valid",
    subcircuit_id: "sub_b",
    x: 20,
    y: 0,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
  }
  const validPadOnSecondBoard: AnyCircuitElement = {
    type: "pcb_smtpad",
    pcb_smtpad_id: "pad_b_valid",
    subcircuit_id: "sub_b",
    shape: "rect",
    x: 20,
    y: 0,
    width: 1,
    height: 1,
    layer: "top",
  }

  const validCircuit: AnyCircuitElement[] = [
    firstBoard,
    secondBoard,
    validViaOnSecondBoard,
    validPadOnSecondBoard,
  ]
  expect(checkCopperToBoardEdgeClearance(validCircuit)).toEqual([])
  expect(
    checkCopperToBoardEdgeClearance([
      secondBoard,
      firstBoard,
      validViaOnSecondBoard,
      validPadOnSecondBoard,
    ]),
  ).toEqual([])
  expect(checkViasOffBoard(validCircuit)).toEqual([])

  // A via or pad violating board B's boundary is detected even when a larger board A comes first.
  const wideFirstBoard = { ...firstBoard, width: 60 }
  const violatingViaOnSecondBoard: AnyCircuitElement = {
    ...validViaOnSecondBoard,
    pcb_via_id: "via_b_outside",
    x: 24.9,
  }
  const violatingCircuit: AnyCircuitElement[] = [
    wideFirstBoard,
    secondBoard,
    violatingViaOnSecondBoard,
  ]
  const clearanceErrors = checkCopperToBoardEdgeClearance(violatingCircuit)
  expect(clearanceErrors).toHaveLength(1)
  expect(clearanceErrors[0]?.pcb_placement_error_id).toBe(
    "copper_too_close_to_board_edge_via_b_outside",
  )
  expect(
    checkCopperToBoardEdgeClearance([
      secondBoard,
      wideFirstBoard,
      violatingViaOnSecondBoard,
    ]),
  ).toEqual(clearanceErrors)

  const viaOffBoardErrors = checkViasOffBoard(violatingCircuit)
  expect(viaOffBoardErrors).toHaveLength(1)
  expect(viaOffBoardErrors[0]?.pcb_placement_error_id).toBe(
    "out_of_board_via_b_outside",
  )

  // Via ownership resolved through its owning pcb_trace subcircuit.
  const traceOnSecondBoard: AnyCircuitElement = {
    type: "pcb_trace",
    pcb_trace_id: "trace_b",
    subcircuit_id: "sub_b",
    route: [
      { route_type: "wire", x: 18, y: 0, width: 0.2, layer: "top" },
      { route_type: "wire", x: 20, y: 0, width: 0.2, layer: "top" },
    ],
  }
  const viaOwnedByTrace: AnyCircuitElement = {
    type: "pcb_via",
    pcb_via_id: "via_from_trace_b",
    pcb_trace_id: "trace_b",
    x: 20,
    y: 0,
    outer_diameter: 0.6,
    hole_diameter: 0.3,
    layers: ["top", "bottom"],
  }
  expect(
    checkViasOffBoard([
      firstBoard,
      secondBoard,
      traceOnSecondBoard,
      viaOwnedByTrace,
    ]),
  ).toEqual([])
})

test("trace-out-of-board check evaluates each trace against its owning board and board-specific clearance", () => {
  const validTraceOnSecondBoard: AnyCircuitElement = {
    type: "pcb_trace",
    pcb_trace_id: "trace_b_valid",
    subcircuit_id: "sub_b",
    route: [
      { route_type: "wire", x: 18, y: 0, width: 0.2, layer: "top" },
      { route_type: "wire", x: 22, y: 0, width: 0.2, layer: "top" },
    ],
  }

  expect(
    checkPcbTracesOutOfBoard([
      firstBoard,
      secondBoard,
      validTraceOnSecondBoard,
    ]),
  ).toEqual([])
  expect(
    checkPcbTracesOutOfBoard([
      secondBoard,
      firstBoard,
      validTraceOnSecondBoard,
    ]),
  ).toEqual([])

  // A trace near board B's edge fails when board B has a stricter min_board_edge_clearance,
  // even if board A comes first with a looser clearance and wider outline.
  const wideFirstBoard = {
    ...firstBoard,
    width: 60,
    min_board_edge_clearance: 0.1,
  }
  const strictSecondBoard = {
    ...secondBoard,
    min_board_edge_clearance: 0.8,
  }
  const traceNearSecondBoardEdge: AnyCircuitElement = {
    type: "pcb_trace",
    pcb_trace_id: "trace_b_near_edge",
    subcircuit_id: "sub_b",
    route: [
      { route_type: "wire", x: 18, y: 4.5, width: 0.2, layer: "top" },
      { route_type: "wire", x: 22, y: 4.5, width: 0.2, layer: "top" },
    ],
  }

  const traceErrors = checkPcbTracesOutOfBoard([
    wideFirstBoard,
    strictSecondBoard,
    traceNearSecondBoardEdge,
  ])
  expect(traceErrors).toHaveLength(1)
  expect(traceErrors[0]?.pcb_trace_id).toBe("trace_b_near_edge")
  expect(
    checkPcbTracesOutOfBoard([
      strictSecondBoard,
      wideFirstBoard,
      traceNearSecondBoardEdge,
    ]),
  ).toEqual(traceErrors)

  // Unowned trace in a multi-board circuit is skipped rather than attributed to boards[0].
  expect(
    checkPcbTracesOutOfBoard([
      firstBoard,
      secondBoard,
      { ...validTraceOnSecondBoard, subcircuit_id: undefined },
    ]),
  ).toEqual([])
})
