import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

test("same-net annulus contact still reports a drill intersecting the SMT pad", () => {
  const circuit: AnyCircuitElement[] = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL("../../assets/butterstick-placement.json.gz", import.meta.url),
      ),
    ).toString(),
  )
  // Enlarge the native 0.2 mm drill to reach C165's pad; copper stays fixed.
  const drilled = circuit.map(
    (element): AnyCircuitElement =>
      element.type === "pcb_plated_hole" &&
      element.shape === "circle" &&
      Math.hypot(element.x - 18.3, element.y + 5.65) < 1e-5
        ? { ...element, hole_diameter: 0.4 }
        : element,
  )
  const errors = checkPcbComponentOverlap(drilled)
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("C165.NATIVE_1")
  expect(errors[0].message).toContain("U18.NATIVE_8")
})
