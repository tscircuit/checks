import { expect, test } from "bun:test"
import { lcdEscape, checkEscape } from "./via-annulus-smt-fixture"

test("route-only via copper can also land on the top pad", () => {
  expect(checkEscape(lcdEscape().filter((e) => e.type !== "pcb_via"))).toEqual(
    [],
  )
})
