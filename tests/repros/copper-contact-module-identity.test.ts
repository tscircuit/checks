import { expect, test } from "bun:test"
import { createRequire } from "node:module"
import { Box, Polygon } from "@flatten-js/core"
import type { AnyCircuitElement } from "circuit-json"
import { createCopperPolygonContactTester } from "lib/copper-pour-connectivity/create-copper-polygon-contact-tester"
import { copperContactSnapshot } from "../fixtures/copper-contact-snapshot"

test("copper contact crashes when polygons use independent Flatten constructors", () => {
  // The package's ESM and CJS entrypoints provide real independent constructors,
  // as can happen when the checker and a geometry producer load separate copies.
  const other = createRequire(import.meta.url)(
    "@flatten-js/core",
  ) as typeof import("@flatten-js/core")
  expect(other.Polygon).not.toBe(Polygon)

  // Overlapping strips with no contained vertices force the edge-distance path.
  // Use the same coordinate scale and tolerance as copper connectivity checks.
  const horizontal = new Polygon(new Box(-2, -0.25, 2, 0.25)).scale(1e6, 1e6)
  const vertical = new Polygon(new Box(0.4, -2, 0.9, 2)).scale(1e6, 1e6)
  const foreignVertical = new other.Polygon(
    new other.Box(0.4e6, -2e6, 0.9e6, 2e6),
  )
  const touches = createCopperPolygonContactTester(0.1)

  expect(touches(horizontal, vertical)).toBe(true)

  let error: unknown
  try {
    touches(horizontal, foreignVertical)
  } catch (cause) {
    error = cause
  }
  expect(error).toBeInstanceOf(TypeError)
  // Core prefixes this exception with "DRC could not complete (routing): ".
  expect(error).toHaveProperty(
    "message",
    "undefined is not an object (evaluating 'edge.distanceTo(candidate.shape)[0]')",
  )

  // Render the caught exception using core's routing DRC diagnostic format.
  if (!(error instanceof Error))
    throw new Error("Expected the contact checker to throw")
  const diagnostics: AnyCircuitElement[] = [
    {
      type: "source_runtime_error",
      source_runtime_error_id: "contact_runtime_error",
      error_type: "source_runtime_error",
      phase_name: "PcbDesignRuleChecks",
      message: `DRC could not complete (routing): ${error.message}`,
    },
  ]
  const svg = copperContactSnapshot(
    horizontal.box,
    foreignVertical.box,
    diagnostics,
    "Contact check: crashed",
  )
  expect(svg).toContain("DRC could not complete (routing):")
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
