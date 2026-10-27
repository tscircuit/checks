import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { createHash } from "node:crypto"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkCopperPourIslands } from "../../index"

test("full published AM3352 board: detect and natively render the GND island warnings", () => {
  const originalJson = gunzipSync(
    readFileSync(
      new URL("../assets/am3352-six-layer.circuit.json.gz", import.meta.url),
    ),
  )
  expect(createHash("sha256").update(originalJson).digest("hex")).toBe(
    "102347c87209faf6600229e7a5ec533b5eb90839cd904629457bd9a61e1dab02",
  )
  const circuit = JSON.parse(originalJson.toString()) as AnyCircuitElement[]
  expect(
    circuit.filter((element) => element.type === "pcb_copper_pour"),
  ).toHaveLength(323)
  const warnings = checkCopperPourIslands(circuit)
  expect(warnings).toHaveLength(254)
  const groundWarnings = warnings.filter(
    (warning) => warning.source_net_id === "source_net_56",
  )
  expect(groundWarnings).toHaveLength(141)
  // Every original copper, component and route record is rendered unchanged.
  // Pre-existing unrelated diagnostics are hidden to focus on island warnings.
  const drawingCircuit = [
    ...circuit.filter((element) => !element.type.endsWith("_warning")),
    ...warnings,
  ]
  for (const [layer, count] of [
    ["inner1", 105],
    ["bottom", 17],
  ] as const) {
    const svg = convertCircuitJsonToPcbSvg(drawingCircuit, {
      layer,
      width: 1400,
      height: 1160,
      shouldDrawWarnings: true,
    })
    expect(svg.split('class="pcb-copper-pour-style-warning"').length - 1).toBe(
      count,
    )
    expect(svg).toContain(
      `Copper pour for GND has an isolated island on ${layer}`,
    )
    expect(svg).toMatchSvgSnapshot(
      import.meta.path,
      `am3352-full-${layer}-island-warnings`,
    )
  }
}, 90_000)
