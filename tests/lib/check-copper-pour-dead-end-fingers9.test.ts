import { expect, test } from "bun:test"
import { net, pour, via, check } from "../fixtures/copper-pour-dead-end-fingers"

test("exempts a same-net via near the tip, but not a base via, foreign net or wrong layer", () => {
  expect(check(pour(), via())).toEqual([])
  expect(check(pour(), via(5))).toHaveLength(1)
  expect(
    check(pour(), { ...via(), source_net_id: "another_net" }),
  ).toHaveLength(1)
  expect(check(pour(), { ...via(), layers: ["bottom"] })).toHaveLength(1)
  // Through-via spans are expanded by the shared geometry converter.
  expect(check({ ...pour(), layer: "inner1" }, via())).toEqual([])
  expect(
    check(
      { ...pour(), layer: "bottom" },
      { ...via(), layers: ["top", "inner1"] },
    ),
  ).toHaveLength(1)
  expect(
    check(
      { ...pour(), layer: "inner1" },
      { ...via(), layers: ["top", "inner1", "bottom"] },
    ),
  ).toEqual([])
  // A drill void enclosing the distal branch is not copper contact.
  expect(
    check(pour(), { ...via(), outer_diameter: 20, hole_diameter: 18 }),
  ).toHaveLength(1)
})
