import { expect, test } from "bun:test"
import {
  net,
  outline,
  pour,
  check,
} from "../fixtures/copper-pour-dead-end-fingers"

test("unites same-net pours before checking, retaining fingers hidden by duplicate pours", () => {
  expect(
    check(pour(), { ...pour(), pcb_copper_pour_id: "duplicate" }),
  ).toHaveLength(1)
  const connection = {
    ...pour(),
    pcb_copper_pour_id: "second_pour",
    shape: "rect",
    center: { x: 12, y: 3 },
    width: 5,
    height: 6,
  }
  expect(check(pour(), connection)).toEqual([])
  expect(check(pour(), { ...connection, width: 4 })).toEqual([])
  expect(check(pour(), { ...connection, layer: "bottom" })).toHaveLength(1)
  expect(
    check(pour(), { ...connection, source_net_id: "different_net" }),
  ).toHaveLength(1)
  const disjoint = {
    ...pour(outline().map(({ x, y }) => ({ x: x + 30, y }))),
    pcb_copper_pour_id: "disjoint",
  }
  expect(check(pour(), disjoint)).toHaveLength(2)
})
