import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkSameNameNetsAreConnected } from "../../index"

test("disconnected GND nets show the schematic and naming warning", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      {["Sensor", "Controller"].map((name, index) => (
        <subcircuit name={name} key={name} schX={index * 6}>
          <schematictext text={name} schY={2} fontSize={0.3} />
          <resistor name={`R${index + 1}`} resistance="1k" />
          <netlabel net="GND" connectsTo={`R${index + 1}.pin2`} schY={-2} />
        </subcircuit>
      ))}
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const warnings = checkSameNameNetsAreConnected(circuitJson)
  expect(warnings).toHaveLength(1)
  expect(warnings[0]!.net_name).toBe("GND")

  const schematic = convertCircuitJsonToSchematicSvg(circuitJson, {
    width: 800,
    height: 360,
  })
  // Source warnings have no SVG overlay yet. Show the emitted DRC message
  // beneath the schematic so this snapshot checks both together.
  const messageLines = warnings[0]!.message.match(/.{1,90}(?:\s|$)/g)!
  const escapeXml = (text: string) =>
    text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="490" viewBox="0 0 800 490">
    <rect width="800" height="490" fill="white" />
    ${schematic}
    <rect x="16" y="376" width="768" height="98" rx="6" fill="#fff8e6" stroke="#ba8100" />
    <text x="32" y="402" font-family="sans-serif" font-size="16" font-weight="bold" fill="#785300">DRC warning: disconnected same-name nets</text>
    ${messageLines.map((line, index) => `<text x="32" y="${428 + index * 22}" font-family="sans-serif" font-size="14" fill="#463800">${escapeXml(line.trim())}</text>`).join("")}
  </svg>`
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})
