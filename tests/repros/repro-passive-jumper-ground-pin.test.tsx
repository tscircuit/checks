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
  expect(warnings).toEqual([])
  const svg = convertCircuitJsonToSchematicSvg(circuitJson, {
    width: 1200,
    height: 600,
  }).replace(/[ \t]+$/gm, "")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
