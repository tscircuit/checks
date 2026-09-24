import { checkTracesAreContiguous } from "../../lib/check-traces-are-contiguous/check-traces-are-contiguous"
import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"

test("generated antenna open end is not dangling", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={70} height={25} schematicDisabled routingDisabled>
      <antenna
        name="Radio"
        pcbX={-15.5}
        antennaShape="2.4ghz_quarter_wave_monopole"
      />
      <pcbnotetext
        text="BROKEN: intentional antenna end reported as error"
        pcbY={-9}
        fontSize={0.6}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  // Core's marker support is merged in tscircuit/core#4132 but not released yet.
  // This antenna-only fixture supplies the published Circuit JSON field.
  const circuitJson = circuit.getCircuitJson()
  for (const element of circuitJson) {
    if (element.type === "pcb_trace") {
      element.is_antenna_trace = true
    }
  }
  // Current checker reports an intentional antenna endpoint.
  const errors = checkTracesAreContiguous(circuitJson)
  expect(errors).toHaveLength(1)
  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
