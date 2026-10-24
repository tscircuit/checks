import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { checkSchematicComponentMissingReferenceDesignatorText } from "lib/check-schematic-component-missing-reference-designator-text"
import { Circuit } from "tscircuit"

const ReferenceSymbol = ({ label }: { label?: string }) => (
  <symbol>
    <schematicpath
      points={[
        { x: -1, y: -0.5 },
        { x: 1, y: -0.5 },
        { x: 1, y: 0.5 },
        { x: -1, y: 0.5 },
        { x: -1, y: -0.5 },
      ]}
      strokeWidth={0.03}
      strokeColor="#880000"
      isFilled
      fillColor="#fff7cc"
    />
    {label && <schematictext text={label} schY={0.1} fontSize={0.25} />}
    <port name="1" pinNumber={1} direction="right" schX={1} schY={0} />
  </symbol>
)

const renderReferenceCase = async ({
  name,
  label,
}: { name: string; label?: string }) => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board>
      <chip name={name} symbol={<ReferenceSymbol label={label} />} />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  return {
    name,
    label,
    circuitJson,
    warnings:
      checkSchematicComponentMissingReferenceDesignatorText(circuitJson),
    symbolTexts: circuitJson.flatMap((element) =>
      element.type === "schematic_text" && element.schematic_symbol_id
        ? [element.text]
        : [],
    ),
  }
}

const escapeSvgText = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

test("the missing-refdes hint resolves to working reference text", async () => {
  const missingReference = await renderReferenceCase({ name: "MP1" })
  const suggestedPlaceholder = missingReference.warnings[0].message.match(
    /<schematictext text="([^"]+)" \/>/,
  )?.[1]
  expect(suggestedPlaceholder).toBe("{REF}")
  const cases = await Promise.all([
    Promise.resolve(missingReference),
    renderReferenceCase({ name: "MP2", label: "{REFDES}" }),
    renderReferenceCase({ name: "MP3", label: suggestedPlaceholder }),
    renderReferenceCase({ name: "MP4", label: "{NAME}" }),
  ])
  expect(cases.map((result) => result.warnings.length)).toEqual([1, 1, 0, 0])
  expect(cases[0].warnings[0].message).toContain(
    '<schematictext text="{REF}" />',
  )
  expect(cases[1].symbolTexts).toEqual(["{REFDES}"])
  expect(cases[2].symbolTexts).toEqual(["MP3"])
  expect(cases[3].symbolTexts).toEqual(["MP4"])
  const panels = cases.map((result, index) => {
    const title = result.label ? `text="${result.label}"` : "No reference text"
    const status = `${result.name}: ${result.warnings.length} missing-refdes warning${result.warnings.length === 1 ? "" : "s"}`
    const drawing = convertCircuitJsonToSchematicSvg(result.circuitJson, {
      width: 300,
      height: 200,
    })
    return `<g transform="translate(${index * 300},0)"><text x="150" y="35" text-anchor="middle" font-size="18">${escapeSvgText(title)}</text><g transform="translate(0,55)">${drawing}</g><text x="150" y="285" text-anchor="middle" font-size="15" fill="${result.warnings.length ? "#b91c1c" : "#166534"}">${status}</text></g>`
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="380" viewBox="0 0 1200 380"><rect width="1200" height="380" fill="#f8fafc"/><g font-family="sans-serif" fill="#111827">${panels.join("")}<text x="25" y="330" font-size="15">Actual checker message:</text><text x="25" y="355" font-size="12">${escapeSvgText(cases[0].warnings[0].message)}</text></g></svg>`
  await expect(svg.replace(/[ \t]+$/gm, "")).toMatchSvgSnapshot(
    import.meta.path,
  )
})
