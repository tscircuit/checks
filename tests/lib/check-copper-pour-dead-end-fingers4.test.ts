import { expect, test } from "bun:test"
import { checkCopperPourDeadEndFingers } from "../../index"
import {
  outline,
  pour,
  circuit,
} from "../fixtures/copper-pour-dead-end-fingers"

test("supports adjustable dimensional thresholds and rejects invalid options", () => {
  const input = circuit(pour())
  for (const options of [
    { maxWidth: 0.9 },
    { minLength: 6 },
    { minAspectRatio: 6 },
  ]) {
    expect(checkCopperPourDeadEndFingers(input, options)).toEqual([])
  }
  expect(
    checkCopperPourDeadEndFingers(circuit(pour(outline(6, 1.5))), {
      maxWidth: 1.5,
    }),
  ).toHaveLength(1)
  for (const key of ["maxWidth", "minLength", "minAspectRatio"]) {
    for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        checkCopperPourDeadEndFingers(input, { [key]: value }),
      ).toThrow(RangeError)
    }
  }
})
