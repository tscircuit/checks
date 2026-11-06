import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { checkNoGroundPinDefined } from "lib/check-no-ground-pin-defined"
import { Circuit } from "tscircuit"

// Reduced from JP_VDDD in krishnax12/mtr-tiny-md.
async function createJumperCircuit() {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board routingDisabled>
      <jumper
        name="JP_VDDD"
        pinLabels={{ pin1: "A", pin2: "B" }}
        pinAttributes={{ A: { isPassive: true }, B: { isPassive: true } }}
        connections={{ A: "net.V3V3", B: "net.VDDD" }}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  return circuit.getCircuitJson()
}

test("repro: passive MTR jumper ground-pin warning", async () => {
  const circuitJson = await createJumperCircuit()
  const ports = circuitJson.filter((element) => element.type === "source_port")
  expect(ports).toHaveLength(2)
  expect(ports.every((port) => port.is_passive === true)).toBe(true)
  const warnings = checkNoGroundPinDefined(circuitJson)
  const svg = convertCircuitJsonToSchematicSvg(circuitJson, {
    width: 1200,
    height: 600,
  })
    .replace(
      "</svg>",
      `${warnings.map((warning, index) => `<text x="20" y="${24 + index * 17}" fill="red" font-family="sans-serif" font-size="13">${warning.message.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</text>`).join("")}</svg>`,
    )
    .replace(/[ \t]+$/gm, "")
  expect(svg).toMatchSvgSnapshot(import.meta.path)
})

test.failing("a passive jumper does not require a ground pin", async () => {
  expect(checkNoGroundPinDefined(await createJumperCircuit())).toEqual([])
})
