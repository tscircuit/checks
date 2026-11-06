import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { checkNoGroundPinDefined } from "lib/check-no-ground-pin-defined"
import { checkNoPowerPinDefined } from "lib/check-no-power-pin-defined"
import { checkPinMustBeConnected } from "lib/check-pin-must-be-connected"
import {
  createPassiveJumperGroundCase,
  passiveJumperGroundCases,
} from "../fixtures/passive-jumper-ground-cases"

function escapeXml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

test("passive jumper warnings and valid active-chip and connection controls", async () => {
  const panels: string[] = []
  for (const [index, scenario] of passiveJumperGroundCases.entries()) {
    const circuitJson = await createPassiveJumperGroundCase(scenario)
    const groundWarnings = checkNoGroundPinDefined(circuitJson)
    const powerWarnings = checkNoPowerPinDefined(circuitJson)
    const connectionErrors = checkPinMustBeConnected(circuitJson)
    expect(powerWarnings).toHaveLength(scenario.powerWarnings)
    expect(connectionErrors).toHaveLength(scenario.connectionErrors)
    if (!scenario.knownBug)
      expect(groundWarnings).toHaveLength(scenario.groundWarnings)
    const drawing = convertCircuitJsonToSchematicSvg(circuitJson, {
      width: 600,
      height: 280,
    })
    const diagnostics = [
      ...groundWarnings,
      ...powerWarnings,
      ...connectionErrors,
    ]
    const lines = diagnostics
      .map(
        (diagnostic, line) =>
          `<text x="16" y="${338 + line * 20}" font-family="sans-serif" font-size="12" fill="#b91c1c">${escapeXml(diagnostic.message)}</text>`,
      )
      .join("")
    panels.push(
      `<svg x="${(index % 3) * 600}" y="${Math.floor(index / 3) * 420}" width="600" height="420"><rect width="600" height="420" fill="#f5f1ed" stroke="#ccc"/><text x="16" y="26" font-family="sans-serif" font-size="17">${escapeXml(scenario.title)}</text><svg y="36" width="600" height="280">${drawing}</svg>${lines || '<text x="16" y="338" font-family="sans-serif" font-size="13" fill="#006464">No power/ground-presence or required-connection findings.</text>'}<text x="16" y="402" font-family="sans-serif" font-size="12" fill="#555">${scenario.knownBug ? "Known false warning: a dedicated ground pin is not required." : "Control: the findings shown above are expected."}</text></svg>`,
    )
  }
  expect(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1260">${panels.join("")}</svg>`.replace(
      /[ \t]+$/gm,
      "",
    ),
  ).toMatchSvgSnapshot(import.meta.path)
})

for (const scenario of passiveJumperGroundCases.filter(
  (scenario) => scenario.knownBug,
)) {
  test.failing(
    `${scenario.title}: no ground-pin warning is required`,
    async () => {
      const circuitJson = await createPassiveJumperGroundCase(scenario)
      expect(checkNoGroundPinDefined(circuitJson)).toEqual([])
    },
  )
}
