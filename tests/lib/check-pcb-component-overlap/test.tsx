import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

const OverlapRepro = () => (
  <board width="48mm" height="22mm" routingDisabled>
    <chip
      name="USBC1"
      pcbX={0}
      pcbY={8.1}
      schX={-8}
      schY={0}
      pinLabels={{ 1: ["A4B9"] }}
      footprint={
        <footprint>
          <smtpad
            shape="rect"
            width="2mm"
            height="2mm"
            pcbX="0mm"
            pcbY="0mm"
            portHints={["A4B9"]}
          />
        </footprint>
      }
    />

    <chip
      name="U1"
      pcbX={0}
      pcbY={8.1}
      schX={8}
      schY={0}
      pinLabels={{ 1: ["USB_DP"] }}
      footprint={
        <footprint>
          <smtpad
            shape="rect"
            width="2mm"
            height="2mm"
            pcbX="1mm"
            pcbY="1mm"
            portHints={["USB_DP"]}
          />
        </footprint>
      }
    />

    <trace from=".USBC1 > .A4B9" to="net.VBUS" />
    <trace from=".U1 > .USB_DP" to="net.USB_DP" />
  </board>
)

test("test.tsx reproduces overlapping pcb_smtpad error with specific message", async () => {
  const circuit = new Circuit()
  circuit.add(<OverlapRepro />)

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const errors = checkPcbComponentOverlap(circuitJson as any)

  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("pcb_smtpad")
  expect(errors[0].message).toContain("USBC1")
  expect(errors[0].message).toContain("U1")
  expect(errors[0].message).toContain("mm")

  const pcbSoupWithErrors = [...circuitJson, ...errors]

  expect(
    convertCircuitJsonToPcbSvg(pcbSoupWithErrors as any, {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
