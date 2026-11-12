import { expect, test } from "bun:test"
import { checkSchematicPlacement } from "../.."
import { createInvertedRailsCircuitJson } from "../fixtures/create-inverted-rails-circuit-json"

test("describes a ground-facing-up finding from the updated analyzer as ground rather than supply", () => {
  const json = createInvertedRailsCircuitJson({ positiveSupply: false })
  for (const e of json) {
    if (e.type === "source_net" && e.name === "VCC") {
      e.name = "SIGNAL"
      e.is_power = false
    }
  }
  expect(checkSchematicPlacement(json)).toMatchObject([
    {
      styling_issue_type: "inverted_rails",
      message:
        "C1 has its ground pin facing up. Rotate C1 by 180° so that pin faces down, preserving pin connections, and reroute attached traces.",
    },
  ])
})
