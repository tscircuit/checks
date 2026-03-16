import { test, expect } from "bun:test"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"
import pinrowJson from "tests/assets/pinrow-rotated-inside-board.json"

test("no false positive: pinrow connectors rotated 90/270 inside board should not trigger errors", () => {
  const circuitJson = pinrowJson as AnyCircuitElement[]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(
    convertCircuitJsonToPcbSvg(
      [...circuitJson, ...errors] as AnyCircuitElement[],
      {
        shouldDrawErrors: true,
      },
    ),
  ).toMatchSvgSnapshot(import.meta.path)

  expect(errors.length).toBe(2)
})
